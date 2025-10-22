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
  PurchasePrice: number;
  ListPrice: number;
  ProductVariants: TPOSProductVariant[];
}

interface TPOSVariantResponse {
  Id: number;
  DefaultCode: string;
  NameTemplate: string;
  PriceVariant: number;        // Giá bán của variant
  StandardPrice: number;       // Giá mua của variant
  QtyAvailable: number;        // Số lượng thực tế
  VirtualAvailable: number;    // Số lượng dự báo
  ImageUrl: string | null;
  Barcode: string | null;
  AttributeValues: Array<{
    Name: string;
    AttributeName: string;
  }>;
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
    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // API mới trả về object trực tiếp (không có .value array)
    if (!data || !data.Id) {
      return null;
    }
    
    return data;
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
    if (tposData.PurchasePrice !== undefined && tposData.PurchasePrice !== null) {
      updateData.purchase_price = tposData.PurchasePrice;
    }
    if (tposData.ListPrice !== undefined && tposData.ListPrice !== null) {
      updateData.selling_price = tposData.ListPrice;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId);

      if (updateError) {
        console.error("Error updating product:", updateError);
      }
    }

    // 2.5. Cập nhật giá cho variants nếu chúng đang có giá = 0
    if (tposData.ListPrice || tposData.PurchasePrice) {
      // Chỉ update selling_price cho variants đang có giá = 0
      if (tposData.ListPrice) {
        const { error: variantSellingError } = await supabase
          .from("products")
          .update({ selling_price: tposData.ListPrice })
          .eq("base_product_code", tposData.DefaultCode)
          .eq("selling_price", 0);
        
        if (!variantSellingError) {
          console.log(`Updated selling_price for variants with base_product_code: ${tposData.DefaultCode}`);
        }
      }
      
      // Chỉ update purchase_price cho variants đang có giá = 0
      if (tposData.PurchasePrice) {
        const { error: variantPurchaseError } = await supabase
          .from("products")
          .update({ purchase_price: tposData.PurchasePrice })
          .eq("base_product_code", tposData.DefaultCode)
          .eq("purchase_price", 0);
        
        if (!variantPurchaseError) {
          console.log(`Updated purchase_price for variants with base_product_code: ${tposData.DefaultCode}`);
        }
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

// =====================================================
// VARIANT SYNC FUNCTIONS
// =====================================================

/**
 * Fetch chi tiết variant từ TPOS API
 */
async function fetchTPOSVariantDetail(
  productIdBienThe: number,
  bearerToken: string
): Promise<TPOSVariantResponse | null> {
  try {
    const url = `https://tomato.tpos.vn/odata/Product(${productIdBienThe})?$expand=UOM,Categ,UOMPO,POSCateg,AttributeValues`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: getTPOSHeaders(bearerToken),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !data.Id) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching TPOS variant ${productIdBienThe}:`, error);
    return null;
  }
}

/**
 * Đồng bộ 1 variant
 */
async function syncSingleVariant(
  productId: string,
  productIdBienThe: number,
  bearerToken: string
): Promise<SyncResult> {
  try {
    // 1. Fetch chi tiết variant từ TPOS
    const tposData = await fetchTPOSVariantDetail(productIdBienThe, bearerToken);
    
    if (!tposData) {
      return {
        success: false,
        productCode: `ID:${productIdBienThe}`,
        message: "Không lấy được dữ liệu từ TPOS",
        variantsUpdated: 0,
      };
    }

    // 2. Build variant text từ AttributeValues
    const variantText = tposData.AttributeValues
      ?.map(attr => attr.Name)
      .join(', ') || '';

    // 3. Cập nhật variant với dữ liệu mới
    const updateData: any = {
      selling_price: tposData.PriceVariant,
      purchase_price: tposData.StandardPrice,
      stock_quantity: tposData.QtyAvailable,
      virtual_available: tposData.VirtualAvailable,
    };

    // Optional fields
    if (tposData.ImageUrl) {
      updateData.tpos_image_url = tposData.ImageUrl;
    }
    if (tposData.Barcode) {
      updateData.barcode = tposData.Barcode;
    }
    if (variantText) {
      updateData.variant = variantText;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId);

    if (updateError) {
      console.error("Error updating variant:", updateError);
      return {
        success: false,
        productCode: tposData.DefaultCode,
        message: updateError.message,
        variantsUpdated: 0,
      };
    }

    return {
      success: true,
      productCode: tposData.DefaultCode,
      message: `Giá: ${tposData.PriceVariant.toLocaleString()}đ | Tồn: ${tposData.QtyAvailable} | Dự báo: ${tposData.VirtualAvailable}`,
      variantsUpdated: 1,
    };
  } catch (error) {
    console.error(`Error syncing variant ${productId}:`, error);
    return {
      success: false,
      productCode: `ID:${productIdBienThe}`,
      message: error instanceof Error ? error.message : "Unknown error",
      variantsUpdated: 0,
    };
  }
}

/**
 * Đồng bộ tất cả variants với batch processing
 */
export async function syncAllVariants(
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 200;

  // 1. Lấy token
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("Không tìm thấy TPOS bearer token");
  }

  // 2. Lấy danh sách variants có productid_bienthe
  let allVariants: any[] = [];
  let page = 0;
  const pageSize = 1000;

  onProgress({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    logs: ["📊 Đang tải danh sách biến thể..."],
  });

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, productid_bienthe")
      .not("productid_bienthe", "is", null)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data || data.length === 0) break;
    
    allVariants.push(...data);
    
    onProgress({
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      logs: [`📊 Đã tải ${allVariants.length} biến thể...`],
    });
    
    if (data.length < pageSize) break;
    page++;
  }

  const variants = allVariants;

  if (!variants || variants.length === 0) {
    throw new Error("Không có biến thể nào cần đồng bộ");
  }

  const total = variants.length;
  const progress: SyncProgress = {
    current: 0,
    total,
    success: 0,
    failed: 0,
    skipped: 0,
    logs: [],
  };

  // 3. Xử lý từng batch
  for (let i = 0; i < variants.length; i += BATCH_SIZE) {
    const batch = variants.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map((variant) =>
        syncSingleVariant(variant.id, variant.productid_bienthe!, bearerToken)
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

      if (progress.logs.length > 100) {
        progress.logs.pop();
      }
    }

    onProgress({ ...progress });

    if (i + BATCH_SIZE < variants.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
}
