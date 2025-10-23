import * as XLSX from "xlsx";
import { TPOS_CONFIG, getTPOSHeaders, getActiveTPOSToken, cleanBase64, randomDelay } from "./tpos-config";
import { 
  getVariantType,
  TPOS_ATTRIBUTE_IDS,
  TPOS_COLOR_MAP,
  TPOS_SIZE_TEXT_MAP,
  TPOS_SIZE_NUMBER_MAP
} from "./tpos-variant-attributes-compat";
import { TPOS_ATTRIBUTES } from "./tpos-attributes";
import { detectVariantsFromText, getSimpleDetection } from "./variant-detector";
import { supabase } from "@/integrations/supabase/client";
import { getVariantName } from "@/lib/variant-utils";

// Extract variant lists from TPOS_ATTRIBUTES
const COLORS = TPOS_ATTRIBUTES.color.map(c => c.Name);
const TEXT_SIZES = TPOS_ATTRIBUTES.sizeText.map(s => s.Name);
const NUMBER_SIZES = TPOS_ATTRIBUTES.sizeNumber.map(s => s.Name);

// =====================================================
// CACHE MANAGEMENT
// =====================================================

const CACHE_KEY = 'tpos_product_cache';
const CACHE_TTL = 1000 * 60 * 30; // 30 phút

/**
 * Lấy cached TPOS IDs từ localStorage
 */
export function getCachedTPOSIds(): Map<string, number> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return new Map();
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check TTL
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return new Map();
    }
    
    return new Map(Object.entries(data));
  } catch (error) {
    console.error('❌ Cache read error:', error);
    return new Map();
  }
}

/**
 * Lưu TPOS IDs vào localStorage
 */
export function saveCachedTPOSIds(ids: Map<string, number>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: Object.fromEntries(ids),
      timestamp: Date.now()
    }));
    console.log(`💾 Cached ${ids.size} TPOS IDs (TTL: 30 phút)`);
  } catch (error) {
    console.error('❌ Cache write error:', error);
  }
}

/**
 * Xóa cache (dùng khi cần refresh)
 */
export function clearTPOSCache() {
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ TPOS Cache cleared');
}

// =====================================================
// TPOS PRODUCT SEARCH
// =====================================================

/**
 * Tìm kiếm sản phẩm từ TPOS theo mã sản phẩm
 */
export async function searchTPOSProduct(productCode: string): Promise<TPOSProductSearchResult | null> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
    }

    const url = `https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(productCode)}&$top=50&$orderby=DateCreated desc&$count=true`;
    
    console.log(`🔍 Searching TPOS for product: ${productCode}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.value && data.value.length > 0) {
      console.log(`✅ Found product in TPOS:`, data.value[0]);
      return data.value[0] as TPOSProductSearchResult;
    }

    console.log(`❌ Product not found in TPOS: ${productCode}`);
    return null;
  }, 'tpos');
}

/**
 * Import sản phẩm từ TPOS vào database
 */
export async function importProductFromTPOS(tposProduct: TPOSProductSearchResult) {
  try {
    // Extract supplier name from product name
    const extractSupplier = (name: string): string | null => {
      // Pattern: ddmm A## format
      if (name.match(/^\d{4}\s+([A-Z]\d{1,4})\s+/)) {
        return name.match(/^\d{4}\s+([A-Z]\d{1,4})\s+/)?.[1] || null;
      }
      // Pattern: [CODE] ddmm A## format
      if (name.match(/^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+/)) {
        return name.match(/^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+/)?.[1] || null;
      }
      // Pattern: A## at the start
      if (name.match(/^([A-Z]\d{1,4})\s+/)) {
        return name.match(/^([A-Z]\d{1,4})\s+/)?.[1] || null;
      }
      return null;
    };

    const supplierName = extractSupplier(tposProduct.Name);
    
    // Check if product already exists
    const { data: existing, error: checkError } = await supabase
      .from('products')
      .select('id, product_code, product_name')
      .eq('product_code', tposProduct.DefaultCode)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      // Product exists → UPDATE instead of INSERT
      const { data, error } = await supabase
        .from('products')
        .update({
          product_name: tposProduct.Name,
          barcode: tposProduct.Barcode || null,
          selling_price: tposProduct.ListPrice || 0,
          purchase_price: tposProduct.StandardPrice || 0,
          unit: tposProduct.UOMName || 'Cái',
          tpos_product_id: tposProduct.Id,
          tpos_image_url: tposProduct.ImageUrl || null,
          product_images: tposProduct.ImageUrl ? [tposProduct.ImageUrl] : null,
          supplier_name: supplierName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ Product UPDATED from TPOS:`, data);
      return { ...data, isUpdated: true };
    }
    
    // Product doesn't exist → INSERT as usual
    const { data, error } = await supabase
      .from('products')
      .insert({
        product_code: tposProduct.DefaultCode,
        product_name: tposProduct.Name,
        barcode: tposProduct.Barcode || null,
        selling_price: tposProduct.ListPrice || 0,
        purchase_price: tposProduct.StandardPrice || 0,
        stock_quantity: 0, // Không lấy số lượng từ TPOS
        unit: tposProduct.UOMName || 'Cái',
        tpos_product_id: tposProduct.Id,
        tpos_image_url: tposProduct.ImageUrl || null,
        product_images: tposProduct.ImageUrl ? [tposProduct.ImageUrl] : null,
        supplier_name: supplierName,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Product INSERTED from TPOS:`, data);
    return { ...data, isUpdated: false };
  } catch (error) {
    console.error('Error importing product from TPOS:', error);
    throw error;
  }
}

// =====================================================
// TPOS PRODUCT SYNC FUNCTIONS
// =====================================================

interface TPOSProduct {
  Id: number;
  DefaultCode: string;
  Name: string;
  Active: boolean;
}

// =====================================================
// TPOS VARIANT SYNC FUNCTIONS (NEW)
// =====================================================

interface TPOSVariantSyncResult {
  parentInfo: {
    ListPrice: number;
    QtyAvailable: number;
    VirtualAvailable: number;
  };
  variants: Array<{
    Id: number;
    DefaultCode: string;
    ListPrice: number;
    QtyAvailable: number;
    VirtualAvailable: number;
  }>;
}

interface SyncResult {
  updated: number;
  skipped: number;
  errors: string[];
  missingInLocal: string[];   // Variants có trên TPOS nhưng không có local
  missingInTPOS: string[];    // Variants có local nhưng không có trên TPOS
}

/**
 * Helper function to normalize product code (remove brackets, trim, uppercase)
 */
function normalizeProductCode(code: string): string {
  return code.replace(/[\[\]]/g, '').trim().toUpperCase();
}

/**
 * B1: Fetch tpos_product_id from TPOS by product code
 */
export async function fetchTPOSProductTemplateId(productCode: string): Promise<number | null> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
    }

    const url = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(productCode)}`;
    
    console.log(`🔍 Fetching TPOS template ID for: ${productCode}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.value && data.value.length > 0) {
      console.log(`✅ Found template ID: ${data.value[0].Id}`);
      return data.value[0].Id;
    }

    console.log(`❌ Template not found for: ${productCode}`);
    return null;
  }, 'tpos');
}

/**
 * B2: Fetch product variants from TPOS
 */
export async function fetchTPOSProductVariants(tposProductId: number): Promise<TPOSVariantSyncResult> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
    }

    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
    
    console.log(`📦 Fetching variants for TPOS ID: ${tposProductId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      parentInfo: {
        ListPrice: data.ListPrice || 0,
        QtyAvailable: data.QtyAvailable || 0,
        VirtualAvailable: data.VirtualAvailable || 0
      },
      variants: (data.ProductVariants || []).map((v: any) => ({
        Id: v.Id,
        DefaultCode: v.DefaultCode,
        ListPrice: v.ListPrice || 0,
        QtyAvailable: v.QtyAvailable || 0,
        VirtualAvailable: v.VirtualAvailable || 0
      }))
    };
  }, 'tpos');
}

/**
 * Main function: Sync variants from TPOS to local database
 */
export async function syncVariantsFromTPOS(parentProductCode: string): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, skipped: 0, errors: [], missingInLocal: [], missingInTPOS: [] };
  
  try {
    // Step 1: Get parent product from database
    const { data: parentProduct, error: parentError } = await supabase
      .from("products")
      .select("id, product_code, tpos_product_id")
      .eq("product_code", parentProductCode)
      .single();
    
    if (parentError || !parentProduct) {
      throw new Error("Parent product not found");
    }

    // Step 2: Fetch tpos_product_id if missing
    let tposProductId = parentProduct.tpos_product_id;
    
    if (!tposProductId) {
      console.log("🔍 Fetching tpos_product_id from TPOS...");
      tposProductId = await fetchTPOSProductTemplateId(parentProductCode);
      
      if (!tposProductId) {
        throw new Error("Sản phẩm cha chưa có trên TPOS. Vui lòng upload lên TPOS trước.");
      }
      
      // Update parent product with tpos_product_id
      await supabase
        .from("products")
        .update({ tpos_product_id: tposProductId })
        .eq("id", parentProduct.id);
    }

    // Step 3: Fetch variants from TPOS
    console.log("📦 Fetching variants from TPOS...");
    const tposData = await fetchTPOSProductVariants(tposProductId);
    
    if (tposData.variants.length === 0) {
      result.skipped = 1;
      return result;
    }

    // Step 4: Fetch local variants
    const { data: localVariants, error: variantsError } = await supabase
      .from("products")
      .select("id, product_code, productid_bienthe")
      .eq("base_product_code", parentProductCode)
      .neq("product_code", parentProductCode);
    
    if (variantsError) throw variantsError;
    
    if (!localVariants || localVariants.length === 0) {
      result.skipped = 1;
      return result;
    }

    // Step 5: Build mapping
    const tposVariantsMap = new Map(
      tposData.variants.map(v => [normalizeProductCode(v.DefaultCode), v])
    );

    // Step 5.5: Detect discrepancies
    // Check variants DƯ trên TPOS (có trên TPOS nhưng không có local)
    tposData.variants.forEach(tposVariant => {
      const normalizedTPOSCode = normalizeProductCode(tposVariant.DefaultCode);
      const localExists = localVariants?.some(local => 
        normalizeProductCode(local.product_code) === normalizedTPOSCode
      );
      
      if (!localExists) {
        result.missingInLocal.push(tposVariant.DefaultCode);
      }
    });

    // Check variants THIẾU trên TPOS (có local nhưng không có trên TPOS)
    localVariants?.forEach(localVariant => {
      const normalizedCode = normalizeProductCode(localVariant.product_code);
      if (!tposVariantsMap.has(normalizedCode)) {
        result.missingInTPOS.push(localVariant.product_code);
      }
    });

    // Step 6: Update each local variant
    for (const localVariant of localVariants) {
      const normalizedCode = normalizeProductCode(localVariant.product_code);
      const tposVariant = tposVariantsMap.get(normalizedCode);
      
      if (!tposVariant) {
        result.errors.push(`Variant ${localVariant.product_code} not found on TPOS`);
        result.skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          selling_price: tposVariant.ListPrice,
          stock_quantity: tposVariant.QtyAvailable,
          productid_bienthe: tposVariant.Id,
          virtual_available: tposVariant.VirtualAvailable
        })
        .eq("id", localVariant.id);
      
      if (updateError) {
        result.errors.push(`Failed to update ${localVariant.product_code}: ${updateError.message}`);
        result.skipped++;
      } else {
        result.updated++;
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

interface TPOSProductSearchResult {
  Id: number;
  Name: string;
  NameGet: string;
  DefaultCode: string;
  Barcode: string;
  StandardPrice: number;
  ListPrice: number;
  ImageUrl: string;
  UOMName: string;
  QtyAvailable: number;
  Active: boolean;
}

interface SyncTPOSProductIdsResult {
  matched: number;
  notFound: number;
  errors: number;
  details: {
    product_code: string;
    tpos_id?: number;
    error?: string;
  }[];
}

/**
 * Fetch TPOS Products with pagination
 */
async function fetchTPOSProducts(skip: number = 0): Promise<TPOSProduct[]> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
    }
    
    const url = `https://tomato.tpos.vn/odata/Product/ODataService.GetViewV2?Active=true&$top=1000&$skip=${skip}&$orderby=DateCreated desc&$filter=Active eq true&$count=true`;
    
    console.log(`[TPOS Product Sync] Fetching from skip=${skip}`);
    
    const response = await fetch(url, {
      headers: getTPOSHeaders(token)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch TPOS products at skip=${skip}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }, 'tpos');
}

/**
 * Sync TPOS Product IDs (biến thể) cho products trong kho
 * @param maxRecords - Số lượng records tối đa muốn lấy (mặc định 4000)
 */
export async function syncTPOSProductIds(
  maxRecords: number = 4000
): Promise<SyncTPOSProductIdsResult> {
  const result: SyncTPOSProductIdsResult = {
    matched: 0,
    notFound: 0,
    errors: 0,
    details: []
  };
  
  try {
    // 1. Lấy tất cả products từ Supabase (bỏ qua N/A và đã có productid_bienthe)
    const { supabase } = await import("@/integrations/supabase/client");
    
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, product_code, productid_bienthe")
      .neq("product_code", "N/A")
      .is("productid_bienthe", null) as any; // Use 'as any' temporarily until types regenerate
    
    if (productsError) throw productsError;
    
    if (!products || products.length === 0) {
      console.log("[TPOS Product Sync] No products to sync");
      return result;
    }
    
    console.log(`[TPOS Product Sync] Found ${products.length} products to sync`);
    
    // 2. Fetch TPOS products với phân trang
    const batches = Math.ceil(maxRecords / 1000);
    const tposProductMap = new Map<string, number>(); // DefaultCode -> Id
    
    for (let i = 0; i < batches; i++) {
      const skip = i * 1000;
      const tposProducts = await fetchTPOSProducts(skip);
      
      if (tposProducts.length === 0) break;
      
      tposProducts.forEach(p => {
        if (p.DefaultCode && p.Active) {
          tposProductMap.set(p.DefaultCode.trim(), p.Id);
        }
      });
      
      console.log(`[TPOS Product Sync] Batch ${i + 1}/${batches}: Fetched ${tposProducts.length} products`);
      
      // Delay để tránh rate limit
      if (i < batches - 1) {
        await randomDelay(300, 600);
      }
    }
    
    console.log(`[TPOS Product Sync] Total TPOS products in map: ${tposProductMap.size}`);
    
    // 3. Match và update
    for (const product of products) {
      const tposId = tposProductMap.get(product.product_code.trim());
      
      if (tposId) {
        try {
          const { error } = await (supabase
            .from("products")
            .update({ productid_bienthe: tposId } as any) // Use 'as any' temporarily
            .eq("id", product.id) as any);
          
          if (error) throw error;
          
          result.matched++;
          result.details.push({
            product_code: product.product_code,
            tpos_id: tposId
          });
          
          console.log(`✓ [${product.product_code}] -> TPOS ID: ${tposId}`);
        } catch (err) {
          result.errors++;
          result.details.push({
            product_code: product.product_code,
            error: err instanceof Error ? err.message : String(err)
          });
          
          console.error(`✗ [${product.product_code}] Error:`, err);
        }
      } else {
        result.notFound++;
        result.details.push({
          product_code: product.product_code
        });
        
        console.log(`⚠ [${product.product_code}] Not found in TPOS`);
      }
    }
    
    console.log("[TPOS Product Sync] Summary:", {
      matched: result.matched,
      notFound: result.notFound,
      errors: result.errors
    });
    
    return result;
    
  } catch (error) {
    console.error("[TPOS Product Sync] Error:", error);
    throw error;
  }
}

/**
 * Upload product details to TPOS Order
 * PUT request to update TPOS order with product details
 */
export async function uploadProductToTPOS(
  tposOrderId: string,
  products: Array<{
    product_code: string;
    product_name: string;
    sold_quantity: number;
    productid_bienthe?: number | null;
    selling_price?: number | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getActiveTPOSToken();
    if (!token) {
      return { success: false, error: "TPOS Bearer Token not found" };
    }
    
    // Fetch product details from Supabase to get productid_bienthe and selling_price
    const productCodes = products.map(p => p.product_code);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("product_code, productid_bienthe, selling_price")
      .in("product_code", productCodes);
    
    if (productError) throw productError;
    
    // Create product map for quick lookup
    const productMap = new Map<string, {
      product_code: string;
      productid_bienthe: number | null;
      selling_price: number | null;
    }>(
      productData?.map(p => [p.product_code, {
        product_code: p.product_code,
        productid_bienthe: p.productid_bienthe,
        selling_price: p.selling_price
      }]) || []
    );
    
    // Build Details array for TPOS
    const details = products.map(p => {
      const dbProduct = productMap.get(p.product_code);
      return {
        ProductId: dbProduct?.productid_bienthe || null,
        ProductName: p.product_name,
        ProductNameGet: `[${p.product_code}] ${p.product_name}`,
        UOMId: 1,
        UOMName: "Cái",
        Quantity: p.sold_quantity,
        Price: dbProduct?.selling_price || 0,
        Factor: 1,
        ProductWeight: 0
      };
    });
    
    // PUT request to TPOS
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${tposOrderId})`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...getTPOSHeaders(token),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ Details: details })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TPOS API Error: ${response.status} - ${errorText}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("[TPOS Upload] Error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface TPOSProductItem {
  id: string;
  product_code: string | null;
  base_product_code: string | null;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
  purchase_order_id: string;
  supplier_name: string;
  tpos_product_id?: number | null;
}

export interface TPOSUploadResult {
  success: boolean;
  totalProducts: number;
  successCount: number;
  failedCount: number;
  savedIds: number;
  productsAddedToInventory?: number;
  variantsCreated?: number;
  variantsFailed?: number;
  variantErrors?: Array<{
    productName: string;
    productCode: string;
    errorMessage: string;
  }>;
  errors: Array<{
    productName: string;
    productCode: string;
    errorMessage: string;
    fullError: any;
  }>;
  imageUploadWarnings: Array<{
    productName: string;
    productCode: string;
    tposId: number;
    errorMessage: string;
  }>;
  productIds: Array<{ itemId: string; tposId: number }>;
}

// =====================================================
// TPOS UTILITIES
// =====================================================

/**
 * Generate TPOS product link
 */
export function generateTPOSProductLink(productId: number): string {
  return `https://tomato.tpos.vn/#/app/producttemplate/form?id=${productId}`;
}

// =====================================================
// IMAGE CONVERSION
// =====================================================

export async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(cleanBase64(base64));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

// =====================================================
// EXCEL GENERATION (for download only - not for TPOS upload)
// =====================================================

export function generateTPOSExcel(items: TPOSProductItem[]): Blob {
  const excelData = items.map((item) => ({
    "Loại sản phẩm": TPOS_CONFIG.DEFAULT_PRODUCT_TYPE,
    "Mã sản phẩm": item.product_code?.toString() || undefined,
    "Mã chốt đơn": undefined,
    "Tên sản phẩm": item.product_name?.toString() || undefined,
    "Giá bán": item.selling_price || 0,
    "Giá mua": item.unit_price || 0,
    "Đơn vị": TPOS_CONFIG.DEFAULT_UOM,
    "Nhóm sản phẩm": TPOS_CONFIG.DEFAULT_CATEGORY,
    "Mã vạch": item.product_code?.toString() || undefined,
    "Khối lượng": undefined,
    "Chiết khấu bán": undefined,
    "Chiết khấu mua": undefined,
    "Tồn kho": undefined,
    "Giá vốn": undefined,
    "Ghi chú": getVariantName(item.variant) || undefined,
    "Cho phép bán ở công ty khác": "FALSE",
    "Thuộc tính": undefined,
    "Link Hình Ảnh": item.product_images?.[0] || undefined,
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Đặt Hàng");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// =====================================================
// TPOS API CALLS
// =====================================================

/**
 * Check if a product exists in TPOS by DefaultCode
 */
export async function checkProductExists(defaultCode: string): Promise<any | null> {
  try {
    const token = await getActiveTPOSToken();
    if (!token) throw new Error("TPOS Bearer Token not found");
    
    const response = await fetch(
      `${TPOS_CONFIG.API_BASE}/OdataService.GetViewV2?Active=true&DefaultCode=${defaultCode}`,
      { headers: getTPOSHeaders(token) }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to check product: ${response.status}`);
    }
    
    const data = await response.json();
    return (data.value && data.value.length > 0) ? data.value[0] : null;
  } catch (error) {
    console.error(`❌ Error checking product ${defaultCode}:`, error);
    return null;
  }
}

/**
 * Create product directly using InsertV2 API
 */
export async function createProductDirectly(
  item: TPOSProductItem,
  imageBase64: string | null,
  attributeLines: any[]
): Promise<any> {
  const token = await getActiveTPOSToken();
  if (!token) throw new Error("TPOS Bearer Token not found");
  
  const payload = {
    Id: 0,
    Name: item.product_name,
    Type: "product",
    ListPrice: item.selling_price || 0,
    PurchasePrice: item.unit_price || 0,
    DefaultCode: item.base_product_code || item.product_code,
    Image: imageBase64 ? cleanBase64(imageBase64) : null,
    ImageUrl: null,
    Thumbnails: [],
    AttributeLines: attributeLines,
    Active: true,
    SaleOK: true,
    PurchaseOK: true,
    UOMId: 1,
    UOMPOId: 1,
    CategId: 2,
    CompanyId: 1,
    Tracking: "none",
    InvoicePolicy: "order",
    PurchaseMethod: "receive",
    AvailableInPOS: true,
    DiscountSale: 0,
    DiscountPurchase: 0,
    StandardPrice: 0,
    Weight: 0,
    SaleDelay: 0,
    UOM: {
      Id: 1, Name: "Cái", Rounding: 0.001, Active: true,
      Factor: 1, FactorInv: 1, UOMType: "reference",
      CategoryId: 1, CategoryName: "Đơn vị"
    },
    UOMPO: {
      Id: 1, Name: "Cái", Rounding: 0.001, Active: true,
      Factor: 1, FactorInv: 1, UOMType: "reference",
      CategoryId: 1, CategoryName: "Đơn vị"
    },
    Categ: {
      Id: 2, Name: "Có thể bán", CompleteName: "Có thể bán",
      Type: "normal", PropertyCostMethod: "average",
      NameNoSign: "Co the ban", IsPos: true
    },
    Items: [],
    UOMLines: [],
    ComboProducts: [],
    ProductSupplierInfos: []
  };
  
  const response = await fetch(
    `${TPOS_CONFIG.API_BASE}/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO`,
    {
      method: 'POST',
      headers: getTPOSHeaders(token),
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create product: ${errorText}`);
  }
  
  return response.json();
}

// DEPRECATED: Excel upload method - keeping for reference
// export async function uploadExcelToTPOS(excelBlob: Blob): Promise<TPOSUploadResponse> { ... }

// DEPRECATED: No longer needed with InsertV2 direct method
// export async function getLatestProducts(count: number): Promise<any[]> { ... }

export async function getProductDetail(productId: number): Promise<any> {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found");
  }
  
  console.log(`🔎 [TPOS] Fetching product detail for ID: ${productId}`);
  
  await randomDelay(200, 600);

  // GetViewV2 doesn't support complex expand - fetch without expand or with basic ones
  const url = `${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2?$filter=Id eq ${productId}`;
  
  console.log(`📡 [TPOS] Calling: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: getTPOSHeaders(token),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [TPOS] Failed to fetch product ${productId}:`, errorText);
    throw new Error(`Failed to fetch product detail: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const products = data.value || data;
  
  if (!products || products.length === 0) {
    throw new Error(`Product with ID ${productId} not found in TPOS`);
  }

  console.log(`✅ [TPOS] Successfully fetched product ${productId}:`, products[0].Name || products[0].Code);
  
  return products[0];
}

/**
 * Check if products exist on TPOS (batch check)
 * Returns a Map of productId -> exists (true/false)
 */
export async function checkTPOSProductsExist(productIds: number[]): Promise<Map<number, boolean>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const token = await getActiveTPOSToken();
  if (!token) {
    console.error('❌ [TPOS] Token not found');
    return new Map();
  }

  console.log(`🔍 [TPOS] Checking existence of ${productIds.length} products...`);
  
  try {
    await randomDelay(300, 700);
    
    // Build filter to check multiple IDs at once
    const idFilter = productIds.map(id => `Id eq ${id}`).join(' or ');
    const filterQuery = encodeURIComponent(idFilter);
    
    // Fetch only ID and Name to minimize payload
    const response = await fetch(
      `${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2?$filter=${filterQuery}&$select=Id,Name`,
      {
        method: "GET",
        headers: getTPOSHeaders(token),
      }
    );

    if (!response.ok) {
      console.error(`❌ [TPOS] Check failed: ${response.status}`);
      // On error, assume all exist (fail-safe)
      const result = new Map<number, boolean>();
      productIds.forEach(id => result.set(id, true));
      return result;
    }

    const data = await response.json();
    const existingIds = new Set((data.value || data).map((p: any) => p.Id));
    
    // Create map of all requested IDs
    const result = new Map<number, boolean>();
    productIds.forEach(id => {
      result.set(id, existingIds.has(id));
    });

    const deletedCount = productIds.length - existingIds.size;
    console.log(`✅ [TPOS] Found ${existingIds.size}/${productIds.length} products (${deletedCount} deleted)`);
    
    return result;
  } catch (error) {
    console.error("❌ checkTPOSProductsExist error:", error);
    // On error, assume all exist (fail-safe)
    const result = new Map<number, boolean>();
    productIds.forEach(id => result.set(id, true));
    return result;
  }
}

// =====================================================
// ATTRIBUTES MANAGEMENT
// =====================================================

export interface TPOSAttribute {
  Id: number;
  Name: string;
  Code?: string;
}

export interface TPOSAttributesResponse {
  sizeText: TPOSAttribute[];
  sizeNumber: TPOSAttribute[];
  color: TPOSAttribute[];
}

export interface DetectedAttributes {
  sizeText?: string[];
  sizeNumber?: string[];
  color?: string[];
}

/**
 * Load danh sách thuộc tính từ TPOS
 */
export async function getTPOSAttributes(): Promise<TPOSAttributesResponse> {
  console.log("🎨 [TPOS] Loading attributes...");
  
  await randomDelay(300, 700);

  try {
    // Lấy danh sách attribute lines/values từ TPOS nếu có API
    // Hiện tại return data từ local constants
    const sizeText: TPOSAttribute[] = TEXT_SIZES.map((size, idx) => ({
      Id: 1000 + idx,
      Name: size,
      Code: size
    }));

    const sizeNumber: TPOSAttribute[] = NUMBER_SIZES.map((size, idx) => ({
      Id: 2000 + idx,
      Name: size,
      Code: `A${size}`
    }));

    const color: TPOSAttribute[] = COLORS.map((color, idx) => ({
      Id: 3000 + idx,
      Name: color,
      Code: color.substring(0, 2).toUpperCase()
    }));

    console.log(`✅ [TPOS] Loaded ${sizeText.length} size text, ${sizeNumber.length} size number, ${color.length} colors`);

    return { sizeText, sizeNumber, color };
  } catch (error) {
    console.error("❌ getTPOSAttributes error:", error);
    throw error;
  }
}

/**
 * Tự động detect thuộc tính từ text (tên sản phẩm, ghi chú)
 * 
 * REFACTORED: Now uses improved variant-detector.ts
 */
export function detectAttributesFromText(text: string): DetectedAttributes {
  if (!text) return {};

  // Use new detection logic
  const result = detectVariantsFromText(text);
  const simple = getSimpleDetection(result);
  
  // Map to old format for backward compatibility
  const detected: DetectedAttributes = {};
  
  if (simple.color.length > 0) detected.color = simple.color;
  if (simple.sizeText.length > 0) detected.sizeText = simple.sizeText;
  if (simple.sizeNumber.length > 0) detected.sizeNumber = simple.sizeNumber;

  console.log("🎯 [TPOS] Detected attributes:", detected);
  return detected;
}

/**
 * Tạo AttributeValues cho TPOS product
 */
export function createAttributeValues(detected: DetectedAttributes): any[] {
  const attributeValues: any[] = [];

  // Helper để tìm attribute config
  const getAttributeConfig = (type: 'sizeText' | 'color' | 'sizeNumber') => {
    switch (type) {
      case 'sizeText':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_TEXT, name: "Size Chữ" };
      case 'color':
        return { id: TPOS_ATTRIBUTE_IDS.COLOR, name: "Màu" };
      case 'sizeNumber':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER, name: "Size Số" };
    }
  };

  // Process size text
  if (detected.sizeText && detected.sizeText.length > 0) {
    const config = getAttributeConfig('sizeText');
    detected.sizeText.forEach(size => {
      const valueData = TPOS_SIZE_TEXT_MAP[size];
      if (valueData) {
        attributeValues.push({
          Id: valueData.Id,
          Name: size,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        });
      }
    });
  }

  // Process colors
  if (detected.color && detected.color.length > 0) {
    const config = getAttributeConfig('color');
    detected.color.forEach(color => {
      const valueData = TPOS_COLOR_MAP[color];
      if (valueData) {
        attributeValues.push({
          Id: valueData.Id,
          Name: color,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${color}`,
          DateCreated: null
        });
      }
    });
  }

  // Process size number
  if (detected.sizeNumber && detected.sizeNumber.length > 0) {
    const config = getAttributeConfig('sizeNumber');
    detected.sizeNumber.forEach(size => {
      const valueData = TPOS_SIZE_NUMBER_MAP[size];
      if (valueData) {
        attributeValues.push({
          Id: valueData.Id,
          Name: size,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        });
      }
    });
  }

  console.log("🎨 [TPOS] Created AttributeValues:", attributeValues);
  return attributeValues;
}

/**
 * Tạo AttributeLines cho TPOS product (format đầy đủ như backend)
 */
export function createAttributeLines(detected: DetectedAttributes): any[] {
  const attributeLines: any[] = [];

  // Helper để tìm attribute config
  const getAttributeConfig = (type: 'sizeText' | 'color' | 'sizeNumber') => {
    switch (type) {
      case 'sizeText':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_TEXT, name: "Size Chữ", code: "SZCh" };
      case 'color':
        return { id: TPOS_ATTRIBUTE_IDS.COLOR, name: "Màu", code: "Mau" };
      case 'sizeNumber':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER, name: "Size Số", code: "SZNu" };
    }
  };

  // Process size text
  if (detected.sizeText && detected.sizeText.length > 0) {
    const config = getAttributeConfig('sizeText');
    const values = detected.sizeText
      .map(size => {
        const data = TPOS_SIZE_TEXT_MAP[size];
        if (!data) return null;
        return {
          Id: data.Id,
          Name: size,
          Code: size,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: 1,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  // Process colors
  if (detected.color && detected.color.length > 0) {
    const config = getAttributeConfig('color');
    const values = detected.color
      .map(color => {
        const data = TPOS_COLOR_MAP[color];
        if (!data) return null;
        return {
          Id: data.Id,
          Name: color,
          Code: color.toLowerCase().replace(/\s+/g, ''),
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${color}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  // Process size number
  if (detected.sizeNumber && detected.sizeNumber.length > 0) {
    const config = getAttributeConfig('sizeNumber');
    const values = detected.sizeNumber
      .map(size => {
        const data = TPOS_SIZE_NUMBER_MAP[size];
        if (!data) return null;
        return {
          Id: data.Id,
          Name: size,
          Code: size,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  console.log("🎨 [TPOS] Created AttributeLines:", JSON.stringify(attributeLines, null, 2));
  return attributeLines;
}

export async function updateProductWithImage(
  productDetail: any,
  base64Image: string,
  detectedAttributes?: DetectedAttributes
): Promise<any> {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found");
  }
  
  console.log(`🖼️ [TPOS] Updating product ${productDetail.Id} with image...`);
  
  await randomDelay(300, 700);

  const payload = { ...productDetail };
  delete payload['@odata.context'];
  payload.Image = cleanBase64(base64Image);

  // Add attributes if detected
  if (detectedAttributes) {
    const attributeLines = createAttributeLines(detectedAttributes);
    
    if (attributeLines.length > 0) {
      payload.AttributeLines = attributeLines;
      console.log(`🎨 [TPOS] Adding ${attributeLines.length} attribute lines`);
    }
  }

  const response = await fetch(`${TPOS_CONFIG.API_BASE}/ODataService.UpdateV2`, {
    method: "POST",
    headers: getTPOSHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ TPOS update failed:", errorText);
    throw new Error(`Failed to update product: ${response.status} - ${errorText}`);
  }

  console.log(`✅ [TPOS] Product ${productDetail.Id} updated`);
  return response.json();
}

// =====================================================
// MAIN UPLOAD FLOW
// =====================================================

export async function uploadToTPOS(
  items: TPOSProductItem[],
  onProgress?: (step: number, total: number, message: string) => void
): Promise<TPOSUploadResult> {
  const result: TPOSUploadResult = {
    success: false,
    totalProducts: items.length,
    successCount: 0,
    failedCount: 0,
    savedIds: 0,
    errors: [],
    imageUploadWarnings: [],
    productIds: [],
  };

  console.log(`🚀 Bắt đầu upload ${items.length} sản phẩm (InsertV2 Direct)`);

  // ========================================
  // PHASE 1: Upload từng product bằng InsertV2
  // ========================================
  let currentStep = 0;
  const totalSteps = items.length;

  for (const item of items) {
    currentStep++;
    
    try {
      onProgress?.(currentStep, totalSteps, `Đang xử lý ${item.product_name}...`);
      
      // Step 1: Kiểm tra sản phẩm đã tồn tại
      const codeToCheck = item.base_product_code || item.product_code;
      console.log(`📦 [${currentStep}/${totalSteps}] Checking ${codeToCheck}...`);
      const existingProduct = await checkProductExists(codeToCheck);
      
      if (existingProduct) {
        console.log(`   ✅ Product exists: ${existingProduct.Id} - ${existingProduct.Name}`);
        
        // Save to productIds for database update
        result.productIds.push({
          itemId: item.id,
          tposId: existingProduct.Id,
        });
        
        // Update cache
        const cache = getCachedTPOSIds();
        cache.set(codeToCheck, existingProduct.Id);
        saveCachedTPOSIds(cache);
        
        result.successCount++;
        
        // TODO: Có thể cập nhật ảnh nếu cần
        if (item.product_images?.[0] && !existingProduct.ImageUrl) {
          console.log(`   🖼️ Updating image for existing product...`);
          try {
            const imageBase64 = await imageUrlToBase64(item.product_images[0]);
            if (imageBase64) {
              const detailResponse = await fetch(
                `${TPOS_CONFIG.API_BASE}(${existingProduct.Id})?$expand=Images,ProductVariants`,
                { headers: getTPOSHeaders(await getActiveTPOSToken() || '') }
              );
              
              if (detailResponse.ok) {
                let productDetail = await detailResponse.json();
                productDetail.Image = cleanBase64(imageBase64);
                delete productDetail["@odata.context"];
                
                const updateResponse = await fetch(
                  `${TPOS_CONFIG.API_BASE}/ODataService.UpdateV2`,
                  {
                    method: "POST",
                    headers: getTPOSHeaders(await getActiveTPOSToken() || ''),
                    body: JSON.stringify(productDetail)
                  }
                );
                
                if (updateResponse.ok) {
                  console.log(`   ✅ Image updated`);
                }
              }
            }
          } catch (error) {
            console.warn(`   ⚠️ Failed to update image:`, error);
          }
        }
        
        await randomDelay(300, 500);
        continue;
      }
      
      // Step 2: Chuyển đổi ảnh sang Base64
      let imageBase64 = null;
      if (item.product_images?.[0]) {
        console.log(`   🖼️ Converting image...`);
        imageBase64 = await imageUrlToBase64(item.product_images[0]);
      }
      
      // Step 3: Tạo AttributeLines (GIỮ NGUYÊN LOGIC CŨ)
      const detected = detectAttributesFromText(item.variant || '');
      const attributeLines = createAttributeLines(detected);
      
      if (detected.color && detected.color.length > 0 || detected.sizeText && detected.sizeText.length > 0 || detected.sizeNumber && detected.sizeNumber.length > 0) {
        console.log(`   🎨 Detected attributes:`, {
          color: detected.color,
          sizeText: detected.sizeText,
          sizeNumber: detected.sizeNumber
        });
      }
      
      // Step 4: Tạo sản phẩm trực tiếp
      console.log(`   ⚡ Creating product on TPOS...`);
      const createdProduct = await createProductDirectly(item, imageBase64, attributeLines);
      
      console.log(`   ✅ Created: ${createdProduct.Id} - ${createdProduct.Name}`);
      
      // Save to productIds for database update
      result.productIds.push({
        itemId: item.id,
        tposId: createdProduct.Id,
      });
      
      // Update cache
      const cache = getCachedTPOSIds();
      cache.set(codeToCheck, createdProduct.Id);
      saveCachedTPOSIds(cache);
      
      result.successCount++;
      
      await randomDelay(500, 1000);
      
    } catch (error) {
      console.error(`   ❌ Error processing ${item.product_code}:`, error);
      result.failedCount++;
      result.errors.push({
        productName: item.product_name,
        productCode: item.product_code,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        fullError: error
      });
    }
  }

  // ========================================
  // PHASE 2: Update database với tpos_product_id
  // ========================================
  console.log(`\n💾 Updating database with ${result.productIds.length} product IDs...`);
  
  for (const mapping of result.productIds) {
    if (!mapping.tposId) continue;
    
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ tpos_product_id: mapping.tposId })
        .eq("id", mapping.itemId);
      
      if (!error) {
        result.savedIds++;
      } else {
        console.warn(`⚠️ Failed to save TPOS ID for item ${mapping.itemId}:`, error);
      }
    } catch (error) {
      console.error(`❌ Database update error for item ${mapping.itemId}:`, error);
    }
  }

  result.success = result.failedCount === 0;
  
  console.log("=".repeat(60));
  console.log(`✅ Upload hoàn tất: ${result.successCount}/${items.length} thành công`);
  console.log(`💾 Saved to DB: ${result.savedIds}/${result.productIds.length} IDs`);
  console.log(`❌ Thất bại: ${result.failedCount}`);
  console.log("=".repeat(60));
  
  return result;
}
