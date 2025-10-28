import { TPOS_CONFIG, getTPOSHeaders, getActiveTPOSToken, cleanBase64, randomDelay } from "./tpos-config";

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

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface TPOSProductSearchResult {
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

// =====================================================
// TPOS API CALLS
// =====================================================

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


// =====================================================
// ATTRIBUTES MANAGEMENT
// =====================================================

export interface TPOSAttribute {
  Id: number;
  Name: string;
  Code?: string;
}


// =====================================================
// DEPRECATED FUNCTIONALITY
// =====================================================
// All variant generation, product sync, and TPOS upload functions have been removed.
// Only search and direct API calls (searchTPOSProduct, createProductDirectly, getProductDetail) remain.

