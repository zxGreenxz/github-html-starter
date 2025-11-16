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

// ===== FETCH & EDIT TPOS PRODUCT INTERFACES =====

/**
 * Full product details từ ProductTemplate({Id})
 */
export interface TPOSProductFullDetails {
  // === BASIC INFO ===
  Id: number;
  Name: string;
  NameGet?: string;
  DefaultCode: string;
  Barcode: string | null;
  Type: string;
  NameNoSign?: string | null;
  
  // === PRICES ===
  ListPrice: number;
  PurchasePrice: number;
  StandardPrice: number;
  LstPrice?: number;
  DiscountSale?: number | null;
  DiscountPurchase?: number | null;
  OldPrice?: number | null;
  
  // === QUANTITIES ===
  QtyAvailable: number;
  QtyForecast: number;
  VirtualAvailable?: number;
  OutgoingQty?: number | null;
  IncomingQty?: number | null;
  InitInventory?: number;
  
  // === IMAGE ===
  Image?: string | null;
  ImageUrl: string | null;
  Thumbnails?: any[];
  
  // === FLAGS ===
  Active: boolean;
  SaleOK: boolean;
  PurchaseOK: boolean;
  AvailableInPOS: boolean;
  IsDiscount?: boolean;
  IsCombo?: boolean | null;
  
  // === RELATIONS ===
  UOM: { Id: number; Name: string } | null;
  UOMPO: { Id: number; Name: string } | null;
  Categ: { Id: number; Name: string; CompleteName: string } | null;
  POSCateg: { Id: number; Name: string } | null;
  UOMCateg?: any;
  
  // === IDs ===
  UOMId?: number;
  UOMPOId?: number;
  CategId?: number;
  POSCategId?: number | null;
  CompanyId?: number | null;
  Product_UOMId?: number | null;
  CreatedById?: number | null;
  
  // === VARIANTS & ATTRIBUTES ===
  ProductVariants: TPOSProductVariantDetail[];
  AttributeLines?: Array<{
    Attribute: {
      Id: number;
    };
    Values: Array<{
      Id: number;
      Name: string;
      Code: string | null;
      Sequence: number | null;
      AttributeId: number;
      AttributeName: string;
      PriceExtra: number | null;
      NameGet: string;
      DateCreated: string | null;
    }>;
    AttributeId: number;
  }>;
  
  // === POLICIES ===
  Tracking?: string | null;
  InvoicePolicy?: string | null;
  PurchaseMethod?: string | null;
  CostMethod?: string | null;
  PropertyCostMethod?: string | null;
  PropertyValuation?: string | null;
  Valuation?: string | null;
  
  // === OTHER ===
  Weight?: number;
  Volume?: number | null;
  SaleDelay?: number;
  Version?: number;
  Description?: string | null;
  LastUpdated?: string | null;
  DateCreated?: string | null;
  
  // === TAXES & TEAMS ===
  Taxes?: any[];
  SupplierTaxes?: any[];
  TaxesIds?: any[];
  Product_Teams?: any[];
  
  // === RELATED ENTITIES ===
  Images?: any[];
  UOMView?: any;
  Distributor?: any;
  Importer?: any;
  Producer?: any;
  OriginCountry?: any;
  UOMLines?: any[];
  ComboProducts?: any[];
  ProductSupplierInfos?: any[];
  Items?: any[];
  
  // === STATISTICS ===
  StockValue?: number | null;
  SaleValue?: number | null;
  PosSalesCount?: number | null;
  AmountTotal?: number | null;
  TaxAmount?: number | null;
  Factor?: number | null;
  
  // === MISC ===
  Tags?: any[] | null;
  OrderTag?: any | null;
  StringExtraProperties?: any | null;
  NameCombos?: any[];
  RewardName?: string | null;
  Error?: any | null;
  DisplayAttributeValues?: any | null;
  NameTemplateNoSign?: string | null;
  ProductTmplEnableAll?: boolean;
}

/**
 * Product variant details
 */
export interface TPOSProductVariantDetail {
  Id: number;
  ProductIdBienThe: number;
  Name: string;
  NameGet?: string; // ✅ Tên biến thể hiển thị (có thể khác với Name)
  DefaultCode: string;
  Barcode: string | null;
  QtyAvailable: number;
  VirtualAvailable?: number; // ✅ Thêm field này theo file mẫu
  QtyForecast: number;
  ListPrice: number;
  PurchasePrice: number;
  StandardPrice: number;
  Active: boolean;
  AttributeValues: TPOSAttributeValueDetail[];
}

/**
 * Attribute value details
 */
export interface TPOSAttributeValueDetail {
  Id: number;
  Name: string;
  AttributeId: number;
  AttributeName: string;
  PriceExtra: number;
}

/**
 * Update product payload - MUST send back entire product object
 * Only override the fields that were edited
 */
export type TPOSUpdateProductPayload = any; // Accept full product structure from API
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

// DELETED: getProductDetail() was faulty - it queried TPOS with parent ID for variants
// which returned incorrect images. Use getTPOSProductFullDetails() instead for accurate data.


// =====================================================
// ATTRIBUTES MANAGEMENT
// =====================================================

export interface TPOSAttribute {
  Id: number;
  Name: string;
  Code?: string;
}


// =====================================================
// FETCH & EDIT TPOS PRODUCT FUNCTIONS
// =====================================================

/**
 * Tìm sản phẩm TPOS theo DefaultCode
 * Endpoint: GET /ProductTemplate/OdataService.GetViewV2
 */
export async function searchTPOSProductByCode(
  productCode: string
): Promise<TPOSProductSearchResult | null> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
    }

    // Optimized: 100-200ms delay (down from 200-600ms)
    await randomDelay(100, 200);
    
    const url = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(productCode)}&$top=50&$orderby=DateCreated desc&$filter=Active+eq+true&$count=true`;
    
    console.log(`🔍 [Fetch & Edit] Searching product: ${productCode}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(token),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Fetch & Edit] Search failed: ${errorText}`);
      throw new Error(`TPOS API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.value && data.value.length > 0) {
      const product = data.value.find((p: any) => p.DefaultCode === productCode);
      if (product) {
        console.log(`✅ [Fetch & Edit] Found product:`, product.Name);
        return product as TPOSProductSearchResult;
      }
    }
    
    console.log(`❌ [Fetch & Edit] Product not found: ${productCode}`);
    return null;
  }, 'tpos');
}

/**
 * Lấy chi tiết đầy đủ sản phẩm từ TPOS (bao gồm variants và attributes)
 * Endpoint: GET /ProductTemplate({Id})?$expand=...
 */
export async function getTPOSProductFullDetails(
  productId: number
): Promise<TPOSProductFullDetails> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');

  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }

    // Optimized: 100-200ms delay (down from 200-600ms)
    await randomDelay(100, 200);
    
    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${productId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,AttributeLines($expand=Attribute,Values),ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
    
    console.log(`📦 [Fetch & Edit] Fetching full details for product ID: ${productId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getTPOSHeaders(token),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Fetch & Edit] Failed to fetch details: ${errorText}`);
      throw new Error(`Failed to fetch product details: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ [Fetch & Edit] Successfully fetched details:`, data.Name);
    
    return data as TPOSProductFullDetails;
  }, 'tpos');
}

/**
 * Cập nhật thông tin sản phẩm lên TPOS
 * Endpoint: POST /ProductTemplate/ODataService.UpdateV2
 */
export async function updateTPOSProductDetails(
  payload: any
): Promise<any> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');

  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }

    // Optimized: 100-200ms delay (down from 200-600ms)
    await randomDelay(100, 200);
    
    const url = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2';
    
    console.log(`📤 [Fetch & Edit] Updating product ID: ${payload.Id}`);
    console.log(`📋 [Fetch & Edit] Full payload (with all fields):`, payload);
    
    // Only clean Base64 if Image field exists
    const cleanedPayload = { ...payload };
    if (cleanedPayload.Image && typeof cleanedPayload.Image === 'string') {
      cleanedPayload.Image = cleanBase64(cleanedPayload.Image);
    }
    
    console.log(`📤 [Fetch & Edit] Sending cleaned payload to TPOS`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getTPOSHeaders(token),
      body: JSON.stringify(cleanedPayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Fetch & Edit] Update failed: ${errorText}`);
      console.error(`❌ [Fetch & Edit] Status: ${response.status}`);
      console.error(`❌ [Fetch & Edit] Payload sent:`, JSON.stringify(cleanedPayload, null, 2));
      
      // Parse error message nếu có
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {}
      
      throw new Error(`Failed to update product: ${errorMessage}`);
    }
    
    const data = await response.json();
    console.log(`✅ [Fetch & Edit] Product updated successfully:`, data);
    
    return data;
  }, 'tpos');
}

// =====================================================
// DEPRECATED FUNCTIONALITY
// =====================================================
// All variant generation, product sync, and TPOS upload functions have been removed.
// Only search and direct API calls (searchTPOSProduct, createProductDirectly) remain.

