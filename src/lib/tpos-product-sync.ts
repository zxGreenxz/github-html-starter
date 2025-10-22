import { supabase } from "@/integrations/supabase/client";
import { getActiveTPOSToken, getTPOSHeaders } from "./tpos-config";

// =====================================================
// TYPES
// =====================================================

interface TPOSProductVariant {
  Id: number;
  DefaultCode: string;
}

interface TPOSProductResponse {
  Id: number;
  DefaultCode: string;
  ImageUrl: string | null;
  StandardPrice: number;
  ListPrice: number;
  ProductVariants: TPOSProductVariant[];
}

export interface SyncProgress {
  current: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  logs: string[];
}

export interface SyncResult {
  success: boolean;
  productCode: string;
  message: string;
  variantsUpdated: number;
}

// =====================================================
// CORE SYNC FUNCTIONS
// =====================================================

/**
 * Fetch chi tiết sản phẩm từ TPOS API
 */
async function fetchTPOSProductDetail(
  tposProductId: number,
  bearerToken: string
): Promise<TPOSProductResponse | null> {
  try {
    const url = `https://tomato.tpos.vn/odata/Product/ODataService.GetViewV2?$filter=Id eq ${tposProductId}&$expand=ProductVariants`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const product = data.value?.[0];
    if (!product) {
      return null;
    }
    return product;
  } catch (error) {
    console.error(`Error fetching TPOS product ${tposProductId}:`, error);
    return null;
  }
}

/**
 * Đồng bộ 1 sản phẩm
 */
async function syncSingleProduct(
  productId: string,
  tposProductId: number,
  bearerToken: string
): Promise<SyncResult> {
  try {
    // 1. Fetch chi tiết từ TPOS
    const tposData = await fetchTPOSProductDetail(tposProductId, bearerToken);
    
    if (!tposData) {
      return {
        success: false,
        productCode: `ID:${tposProductId}`,
        message: "Không lấy được dữ liệu từ TPOS",
        variantsUpdated: 0,
      };
    }

    let variantsUpdated = 0;

    // 2. Cập nhật tpos_image_url, purchase_price, selling_price cho sản phẩm cha
    const updateData: any = {};
    if (tposData.ImageUrl) updateData.tpos_image_url = tposData.ImageUrl;
    if (tposData.StandardPrice) updateData.purchase_price = tposData.StandardPrice;
    if (tposData.ListPrice) updateData.selling_price = tposData.ListPrice;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId);

      if (updateError) {
        console.error("Error updating product:", updateError);
      }
    }

    // 3. Cập nhật base_product_code cho các biến thể con
    if (tposData.ProductVariants && tposData.ProductVariants.length > 0) {
      for (const variant of tposData.ProductVariants) {
        const { error: variantError } = await supabase
          .from("products")
          .update({ base_product_code: tposData.DefaultCode })
          .eq("productid_bienthe", variant.Id);

        if (!variantError) {
          variantsUpdated++;
        }
      }
    }

    return {
      success: true,
      productCode: tposData.DefaultCode,
      message: `Cập nhật ảnh + giá + ${variantsUpdated} variants`,
      variantsUpdated,
    };
  } catch (error) {
    console.error(`Error syncing product ${productId}:`, error);
    return {
      success: false,
      productCode: `ID:${tposProductId}`,
      message: error instanceof Error ? error.message : "Unknown error",
      variantsUpdated: 0,
    };
  }
}

/**
 * Đồng bộ tất cả sản phẩm với batch processing
 */
export async function syncAllProducts(
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 200;

  // 1. Lấy token
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("Không tìm thấy TPOS bearer token");
  }

  // 2. Lấy danh sách sản phẩm có tpos_product_id (với phân trang)
  let allProducts: any[] = [];
  let page = 0;
  const pageSize = 1000;

  onProgress({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    logs: ["📊 Đang tải danh sách sản phẩm..."],
  });

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, tpos_product_id")
      .not("tpos_product_id", "is", null)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data || data.length === 0) break;
    
    allProducts.push(...data);
    
    onProgress({
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      logs: [`📊 Đã tải ${allProducts.length} sản phẩm...`],
    });
    
    if (data.length < pageSize) break;
    page++;
  }

  const products = allProducts;

  if (!products || products.length === 0) {
    throw new Error("Không có sản phẩm nào cần đồng bộ");
  }

  const total = products.length;
  const progress: SyncProgress = {
    current: 0,
    total,
    success: 0,
    failed: 0,
    skipped: 0,
    logs: [],
  };

  // 3. Xử lý từng batch
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    // Xử lý song song các sản phẩm trong batch
    const results = await Promise.all(
      batch.map((product) =>
        syncSingleProduct(product.id, product.tpos_product_id!, bearerToken)
      )
    );

    // Cập nhật progress
    for (const result of results) {
      progress.current++;
      
      if (result.success) {
        progress.success++;
        progress.logs.unshift(
          `✅ ${result.productCode}: ${result.message}`
        );
      } else {
        progress.failed++;
        progress.logs.unshift(
          `❌ ${result.productCode}: ${result.message}`
        );
      }

      // Giới hạn logs ở 100 dòng
      if (progress.logs.length > 100) {
        progress.logs.pop();
      }
    }

    onProgress({ ...progress });

    // Delay giữa các batch (trừ batch cuối)
    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
}
