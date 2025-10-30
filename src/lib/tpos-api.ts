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
      headers: await getTPOSHeaders(token),
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

// =====================================================
// STOCK CHANGE INTERFACES
// =====================================================

/**
 * Item trong response từ /api/stock-change-get-template
 * Response structure: { value: [StockChangeItem, ...] }
 */
export interface StockChangeItem {
  Product: {
    Id: number;              // Variant ID
    Name: string;
    DefaultCode: string;
    Barcode: string | null;
  };
  LocationId: number;         // Kho (cố định = 12)
  NewQuantity: number;        // Số lượng mới (sẽ update)
  TheoreticalQuantity: number;// Số lượng hiện tại
}

/**
 * Response từ GET template
 */
export interface StockChangeTemplateResponse {
  value: StockChangeItem[];
}

/**
 * Payload để POST quantity changes
 */
export interface StockChangePostPayload {
  model: StockChangeItem[];  // Array of modified items
}

/**
 * Payload để execute stock change
 */
export interface StockChangeExecutePayload {
  ids: number[];  // Array of ProductTmplId
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
      headers: await getTPOSHeaders(token),
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
    headers: await getTPOSHeaders(token),
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
    
    await randomDelay(200, 600);
    
    const url = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(productCode)}&$top=50&$orderby=DateCreated desc&$filter=Active+eq+true&$count=true`;
    
    console.log(`🔍 [Fetch & Edit] Searching product: ${productCode}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: await getTPOSHeaders(token),
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
    
    await randomDelay(200, 600);
    
    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${productId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,AttributeLines($expand=Attribute,Values),ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
    
    console.log(`📦 [Fetch & Edit] Fetching full details for product ID: ${productId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: await getTPOSHeaders(token),
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
    
    await randomDelay(200, 600);
    
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
      headers: await getTPOSHeaders(token),
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
// STOCK CHANGE FUNCTIONS - OData Direct Update
// =====================================================

/**
 * Lấy chi tiết một variant từ TPOS
 * Endpoint: GET /odata/Product({Id})?$expand=...
 * 
 * @param variantId - ID của variant (Product ID, không phải ProductTemplate ID)
 * @returns Chi tiết đầy đủ của variant
 */
export async function getVariantDetails(variantId: number): Promise<any> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    await randomDelay(200, 600);
    
    const url = `https://tomato.tpos.vn/odata/Product(${variantId})?$expand=UOM,Categ,UOMPO,POSCateg,AttributeValues`;
    
    console.log(`📦 [Change Size] Fetching variant details: ${variantId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: await getTPOSHeaders(token),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch variant ${variantId}:`, errorText);
      throw new Error(`Failed to fetch variant: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Fetched variant ${variantId}:`, data.DefaultCode, `Qty: ${data.QtyAvailable}`);
    
    return data;
  }, 'tpos');
}

/**
 * Cập nhật stock của một variant
 * Endpoint: POST /odata/Product/ODataService.UpdateV2
 * 
 * ⚠️ QUAN TRỌNG: Phải truyền FULL variant data, chỉ thay đổi QtyAvailable
 * 
 * @param variantId - ID của variant
 * @param newQty - Số lượng mới
 * @param fullVariantData - Dữ liệu đầy đủ của variant (từ getVariantDetails)
 * @returns Response từ TPOS
 */
export async function updateVariantStock(
  variantId: number, 
  newQty: number,
  fullVariantData: any
): Promise<any> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    await randomDelay(200, 600);
    
    const url = 'https://tomato.tpos.vn/odata/Product/ODataService.UpdateV2';
    
    // ✅ Clone full data và chỉ update QtyAvailable
    const payload = {
      ...fullVariantData,
      QtyAvailable: newQty,
      VirtualAvailable: newQty  // Đồng bộ cả VirtualAvailable
    };
    
    // Remove expanded fields (TPOS không cho phép gửi lại)
    delete payload.UOM;
    delete payload.Categ;
    delete payload.UOMPO;
    delete payload.POSCateg;
    delete payload.AttributeValues;
    
    console.log(`📤 [Change Size] Updating variant ${variantId}: ${fullVariantData.DefaultCode}`);
    console.log(`   Old Qty: ${fullVariantData.QtyAvailable} → New Qty: ${newQty}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: await getTPOSHeaders(token),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to update variant ${variantId}:`, errorText);
      throw new Error(`Failed to update stock: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Successfully updated variant ${variantId} stock to ${newQty}`);
    
    return data;
  }, 'tpos');
}

// =====================================================
// DEPRECATED STOCK CHANGE FUNCTIONS (using /api/stock-change-*)
// These functions are kept for reference but should not be used
// =====================================================

/**
 * @deprecated Use getVariantDetails + updateVariantStock instead
 * Step 1: Lấy template để thay đổi số lượng tồn kho
 * POST https://tomato.tpos.vn/api/stock-change-get-template
 * 
 * @param productTmplId - ID của product template (sản phẩm cha)
 * @returns Array of stock change items cho từng variant và location
 */
export async function getStockChangeTemplate(
  productTmplId: number
): Promise<StockChangeItem[]> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    await randomDelay(200, 600);
    
    const url = 'https://tomato.tpos.vn/api/stock-change-get-template';
    
    console.log(`📋 [Stock Change] Step 1: Getting template for ProductTmplId: ${productTmplId}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: await getTPOSHeaders(token),
      body: JSON.stringify({
        model: {
          ProductTmplId: productTmplId
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Stock Change] Get template failed:`, errorText);
      throw new Error(`Failed to get stock change template: ${response.status}`);
    }
    
    const data: StockChangeTemplateResponse = await response.json();
    
    // Response có dạng { value: [...] }
    if (!data.value || !Array.isArray(data.value)) {
      throw new Error("Invalid response format from TPOS");
    }
    
    console.log(`✅ [Stock Change] Template received:`, {
      totalItems: data.value.length,
      items: data.value.map(item => ({
        variantId: item.Product.Id,
        code: item.Product.DefaultCode,
        locationId: item.LocationId,
        currentQty: item.TheoreticalQuantity
      }))
    });
    
    return data.value;
  }, 'tpos');
}

/**
 * @deprecated Use getVariantDetails + updateVariantStock instead
 * Step 2: Gửi số lượng đã thay đổi lên TPOS
 * POST https://tomato.tpos.vn/api/stock-change-post-qty
 * 
 * @param items - Array of modified stock change items
 */
export async function postStockChangeQuantity(
  items: StockChangeItem[]
): Promise<any> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    await randomDelay(200, 600);
    
    const url = 'https://tomato.tpos.vn/api/stock-change-post-qty';
    
    console.log(`📤 [Stock Change] Step 2: Posting quantity changes...`);
    console.log(`📋 [Stock Change] Modified items:`, items.map(item => ({
      variantId: item.Product.Id,
      code: item.Product.DefaultCode,
      locationId: item.LocationId,
      oldQty: item.TheoreticalQuantity,
      newQty: item.NewQuantity,
      diff: item.NewQuantity - item.TheoreticalQuantity
    })));
    
    const payload: StockChangePostPayload = {
      model: items
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: await getTPOSHeaders(token),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Stock Change] Post quantity failed:`, errorText);
      throw new Error(`Failed to post stock changes: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ [Stock Change] Quantities posted successfully, response:`, data);
    
    return data;
  }, 'tpos');
}

/**
 * @deprecated Use getVariantDetails + updateVariantStock instead
 * Step 3: Thực thi việc thay đổi số lượng
 * POST https://tomato.tpos.vn/api/stock-change-execute
 * 
 * @param productTmplId - ID của product template
 */
export async function executeStockChange(
  postQtyResponse: any
): Promise<void> {
  const { queryWithAutoRefresh } = await import('./query-with-auto-refresh');
  
  return queryWithAutoRefresh(async () => {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    await randomDelay(200, 600);
    
    const url = 'https://tomato.tpos.vn/api/stock-change-execute';
    
    // Extract IDs from Step 2 response
    if (!postQtyResponse || !Array.isArray(postQtyResponse.value) || postQtyResponse.value.length === 0) {
      throw new Error("Không thể lấy IDs từ response của bước đăng tải số lượng.");
    }
    
    const idsToExecute = postQtyResponse.value.map((item: any) => item.Id);
    
    console.log(`✅ [Stock Change] Step 3: Executing stock change for IDs:`, idsToExecute);
    
    const payload: StockChangeExecutePayload = {
      ids: idsToExecute
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: await getTPOSHeaders(token),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Stock Change] Execute failed:`, errorText);
      throw new Error(`Failed to execute stock change: ${response.status}`);
    }
    
    console.log(`✅ [Stock Change] Stock change executed successfully`);
  }, 'tpos');
}

// =====================================================
// DEPRECATED FUNCTIONALITY
// =====================================================
// All variant generation, product sync, and TPOS upload functions have been removed.
// Only search and direct API calls (searchTPOSProduct, createProductDirectly, getProductDetail) remain.

