import * as XLSX from "xlsx";
import { TPOS_CONFIG, getTPOSHeaders, getActiveTPOSToken, cleanBase64, randomDelay } from "./tpos-config";
import { supabase } from "@/integrations/supabase/client";
import { getVariantName } from "@/lib/variant-utils";

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

// =====================================================
// VARIANT & UPLOAD FUNCTIONALITY REMOVED
// =====================================================
// All variant generation and TPOS upload functions have been removed.
// Only search, sync, and utility functions remain.
