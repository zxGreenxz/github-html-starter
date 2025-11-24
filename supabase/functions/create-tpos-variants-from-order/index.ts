import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttributeValue {
  id: string;
  value: string;
  code: string | null;
  tpos_id: number;
  tpos_attribute_id: number;
  sequence: number | null;
  name_get: string | null;
  attribute_id: string;
}

interface Attribute {
  id: string;
  name: string;
  display_order: number;
}

/**
 * Parse price input and multiply by 1000
 * Supports both comma and dot as decimal separator
 * Examples: 
 *   - "1.5" or "1,5" → 1500
 *   - "210" → 210000
 *   - 1.5 → 1500
 */
function parsePriceAndMultiply(price: string | number): number {
  if (typeof price === 'number') {
    return Math.round(price * 1000);
  }
  
  // Replace comma with dot for parsing
  const normalized = String(price).replace(',', '.');
  const parsedPrice = parseFloat(normalized);
  
  if (isNaN(parsedPrice)) {
    console.warn(`Invalid price value: "${price}", defaulting to 0`);
    return 0;
  }
  
  return Math.round(parsedPrice * 1000);
}

/**
 * Load image from URL and convert to base64
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

// Convert image URL to base64 with retry (with cache support)
async function imageUrlToBase64WithRetry(
  url: string | null,
  maxRetries = 2,
  cache: Record<string, string> = {} // ✅ NEW - Cache parameter
): Promise<string | null> {
  if (!url) return null;

  // ✅ CHECK CACHE FIRST
  if (cache[url]) {
    console.log(`✅ Using cached base64 for: ${url.substring(0, 50)}...`);
    return cache[url];
  }

  // ⚠️ FALLBACK: Fetch if not in cache
  console.log(`⚠️ Cache miss, fetching: ${url.substring(0, 50)}...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to convert image (attempt ${attempt}/${maxRetries}):`, url);
      const base64 = await imageUrlToBase64(url);
      if (base64) {
        console.log('Image conversion successful');
        return base64;
      }
    } catch (error) {
      console.error(`Image conversion failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to convert image after ${maxRetries} attempts: ${error}`);
      }
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return null;
}

// Parse parent variant from ProductVariants array
// Example: ["NTEST (29, S, Trắng)", "NTEST (30, M, Đen)"] → "(Trắng | Đen) (29 | 30) (S | M)"
function parseParentVariant(productVariants: any[]): string {
  if (!productVariants || productVariants.length === 0) return '';
  
  const allParts: string[][] = [];
  
  for (const variant of productVariants) {
    const match = variant.Name?.match(/\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map((p: string) => p.trim());
      allParts.push(parts);
    }
  }
  
  if (allParts.length === 0) return '';
  
  // Group by position
  const numAttributes = allParts[0].length;
  const grouped: string[][] = Array(numAttributes).fill(null).map(() => []);
  
  for (const parts of allParts) {
    parts.forEach((part, index) => {
      if (index < grouped.length && !grouped[index].includes(part)) {
        grouped[index].push(part);
      }
    });
  }
  
  // Format each group
  return grouped
    .filter(group => group.length > 0)
    .map(group => `(${group.join(' | ')})`)
    .join(' ');
}

// Parse child variant from product name - extract from LAST parenthesis
// Example: "NTEST (FULLBOX) (35)" → "35"
// Example: "NTEST (29, S, Trắng)" → "29, S, Trắng"
function parseChildVariant(productName: string): string {
  if (!productName) {
    console.log('⚠️ parseChildVariant: Empty product name');
    return '';
  }
  
  // Match ALL parentheses and take the LAST one
  const matches = Array.from(productName.matchAll(/\(([^)]+)\)/g));
  
  if (matches.length === 0) {
    console.log(`⚠️ parseChildVariant: No parentheses found in "${productName}"`);
    return '';
  }
  
  // Get the last match
  const result = matches[matches.length - 1][1];
  
  console.log(`📦 parseChildVariant: "${productName}" → variant: "${result}" (from ${matches.length} parentheses)`);
  
  return result;
}

// Generate Cartesian product of arrays
function generateCombinations(arrays: AttributeValue[][]): AttributeValue[][] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0].map(v => [v]);
  
  const result: AttributeValue[][] = [];
  const [first, ...rest] = arrays;
  const restCombinations = generateCombinations(rest);
  
  for (const item of first) {
    for (const combination of restCombinations) {
      result.push([item, ...combination]);
    }
  }
  
  return result;
}

// Get TPOS headers with bearer token
function getTPOSHeaders(bearerToken: string) {
  return {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
    'Tpos-Agent': 'Node.js v20.5.1, Mozilla/5.0, Windows NT 10.0; Win64; x64',
    'Tpos-Retailer': '1'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      baseProductCode,
      productName,
      purchasePrice: rawPurchasePrice,
      sellingPrice: rawSellingPrice,
      productImages,
      supplierName,
      selectedAttributeValueIds,
      imageCache = {} // ✅ NEW - URL -> base64 mapping from frontend
    } = await req.json();

    // Convert prices (multiply by 1000)
    const purchasePrice = parsePriceAndMultiply(rawPurchasePrice);
    const sellingPrice = parsePriceAndMultiply(rawSellingPrice);

    console.log('💰 Price conversion:', {
      raw_purchase: rawPurchasePrice,
      converted_purchase: purchasePrice,
      raw_selling: rawSellingPrice,
      converted_selling: sellingPrice
    });

    // 🖼️ CONVERT IMAGE ONCE - Use cache or fallback fetch
    console.log(`Converting product image to base64... (cache has ${Object.keys(imageCache).length} entries)`);
    let imageBase64: string | null = null;
    if (productImages && productImages.length > 0) {
      try {
        imageBase64 = await imageUrlToBase64WithRetry(productImages[0], 2, imageCache);
        console.log('✅ Image conversion successful');
      } catch (error) {
        console.error('⚠️ Image conversion failed:', error);
        // Continue without image - don't throw error
      }
    }

    if (!baseProductCode || !productName) {
      throw new Error('Missing required parameters: baseProductCode and productName');
    }

    if (purchasePrice <= 0 || sellingPrice <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Giá mua và giá bán phải lớn hơn 0' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============ CASE 1: SIMPLE PRODUCT (NO VARIANTS) ============
    if (!selectedAttributeValueIds || selectedAttributeValueIds.length === 0) {
      console.log('🔹 Creating SIMPLE product WITHOUT variants:', baseProductCode);
      
      // 1. Build simple product payload
      const simplePayload = {
        Id: 0,
        Name: productName,
        NameNoSign: null,
        Description: null,
        Type: "product",
        ShowType: "Có thể lưu trữ",
        ListPrice: sellingPrice,
        DiscountSale: 0,
        DiscountPurchase: 0,
        PurchasePrice: purchasePrice,
        StandardPrice: 0,
        SaleOK: true,
        PurchaseOK: true,
        Active: true,
        UOMId: 1,
        UOMName: null,
        UOMPOId: 1,
        UOMPOName: null,
        UOSId: null,
        IsProductVariant: false,
        EAN13: null,
        DefaultCode: baseProductCode,
        QtyAvailable: 0,
        VirtualAvailable: 0,
        OutgoingQty: 0,
        IncomingQty: 0,
        PropertyCostMethod: null,
        CategId: 2,
        CategCompleteName: null,
        CategName: null,
        Weight: 0,
        Tracking: "none",
        DescriptionPurchase: null,
        DescriptionSale: null,
        CompanyId: 1,
        NameGet: null,
        PropertyStockProductionId: null,
        SaleDelay: 0,
        InvoicePolicy: "order",
        PurchaseMethod: "receive",
        PropertyValuation: null,
        Valuation: null,
        AvailableInPOS: true,
        POSCategId: null,
        CostMethod: null,
        Barcode: baseProductCode,
        Image: imageBase64,
        ImageUrl: null,
        Thumbnails: [],
        ProductVariantCount: 0,
        LastUpdated: null,
        UOMCategId: null,
        BOMCount: 0,
        Volume: null,
        CategNameNoSign: null,
        UOMNameNoSign: null,
        UOMPONameNoSign: null,
        IsCombo: false,
        EnableAll: false,
        ComboPurchased: null,
        TaxAmount: null,
        Version: 0,
        VariantFirstId: null,
        VariantFistId: null,
        ZaloProductId: null,
        CompanyName: null,
        CompanyNameNoSign: null,
        DateCreated: null,
        InitInventory: 0,
        UOMViewId: null,
        ImporterId: null,
        ImporterName: null,
        ImporterAddress: null,
        ProducerId: null,
        ProducerName: null,
        ProducerAddress: null,
        DistributorId: null,
        DistributorName: null,
        DistributorAddress: null,
        OriginCountryId: null,
        OriginCountryName: null,
        InfoWarning: null,
        Element: null,
        YearOfManufacture: null,
        Specifications: null,
        Tags: null,
        CreatedByName: null,
        OrderTag: null,
        StringExtraProperties: null,
        CreatedById: null,
        Error: null,
        UOM: {
          Id: 1,
          Name: "Cái",
          NameNoSign: null,
          Rounding: 0.001,
          Active: true,
          Factor: 1,
          FactorInv: 1,
          UOMType: "reference",
          CategoryId: 1,
          CategoryName: "Đơn vị",
          Description: null,
          ShowUOMType: "Đơn vị gốc của nhóm này",
          NameGet: "Cái",
          ShowFactor: 1,
          DateCreated: "2018-05-25T15:44:44.14+07:00"
        },
        Categ: {
          Id: 2,
          Name: "Có thể bán",
          CompleteName: "Có thể bán",
          ParentId: null,
          ParentCompleteName: null,
          ParentLeft: 0,
          ParentRight: 1,
          Sequence: null,
          Type: "normal",
          AccountIncomeCategId: null,
          AccountExpenseCategId: null,
          StockJournalId: null,
          StockAccountInputCategId: null,
          StockAccountOutputCategId: null,
          StockValuationAccountId: null,
          PropertyValuation: null,
          PropertyCostMethod: "average",
          NameNoSign: "Co the ban",
          IsPos: true,
          Version: null,
          IsDelete: false
        },
        UOMPO: {
          Id: 1,
          Name: "Cái",
          NameNoSign: null,
          Rounding: 0.001,
          Active: true,
          Factor: 1,
          FactorInv: 1,
          UOMType: "reference",
          CategoryId: 1,
          CategoryName: "Đơn vị",
          Description: null,
          ShowUOMType: "Đơn vị gốc của nhóm này",
          NameGet: "Cái",
          ShowFactor: 1,
          DateCreated: "2018-05-25T15:44:44.14+07:00"
        },
        AttributeLines: [],
        Items: [],
        UOMLines: [],
        ComboProducts: [],
        ProductSupplierInfos: [],
        ProductVariants: []
      };

      console.log('Simple payload built, posting to TPOS...');

      // 3. Get TPOS token
      const { data: credentials, error: credError } = await supabase
        .from('tpos_credentials')
        .select('bearer_token')
        .eq('token_type', 'tpos')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (credError || !credentials?.bearer_token) {
        throw new Error('TPOS credentials not found');
      }

      // 4. POST to TPOS
      const tposUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
      const tposResponse = await fetch(tposUrl, {
        method: 'POST',
        headers: getTPOSHeaders(credentials.bearer_token),
        body: JSON.stringify(simplePayload)
      });

      if (!tposResponse.ok) {
        const errorText = await tposResponse.text();
        console.error('❌ TPOS API Error (Simple Product):');
        console.error('Status:', tposResponse.status);
        console.error('Status Text:', tposResponse.statusText);
        console.error('Response:', errorText);
        console.error('Product Code:', baseProductCode);

        // Check if error is due to duplicate product (already exists)
        const isDuplicateError = errorText.includes('đã tồn tại') ||
                                 errorText.includes('already exists') ||
                                 errorText.includes('Đã có sản phẩm với mã vạch');

        if (isDuplicateError && tposResponse.status === 400) {
          console.warn(`⚠️ Product ${baseProductCode} already exists on TPOS, treating as success`);

          // Return success response (product already exists = success)
          return new Response(
            JSON.stringify({
              success: true,
              message: `✅ Sản phẩm ${baseProductCode} đã tồn tại trên TPOS`,
              product_code: baseProductCode,
              already_exists: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        throw new Error(`TPOS API error [${tposResponse.status}]: ${errorText.substring(0, 500)}`);
      }

      const tposData = await tposResponse.json();
      console.log('✅ TPOS simple product created, ID:', tposData.Id);

      // 5. Save to Supabase (only parent product, no children)
      const tposImageBase64 = imageBase64; // Reuse cached image

      const simpleProduct = {
        product_code: tposData.DefaultCode,
        base_product_code: tposData.DefaultCode,
        tpos_product_id: tposData.Id,
        product_name: tposData.Name,
        variant: null,
        selling_price: tposData.ListPrice,
        purchase_price: tposData.PurchasePrice,
        stock_quantity: tposData.QtyAvailable || 0,
        virtual_available: tposData.VirtualAvailable || 0,
        product_images: productImages,
        supplier_name: supplierName
      };

      const { error: dbError } = await supabase
        .from('products')
        .upsert(simpleProduct, { 
          onConflict: 'product_code',
          ignoreDuplicates: false
        });

      if (dbError) {
        console.error('Database save failed:', dbError);
        throw dbError;
      }

      console.log('✅ Simple product saved to database');

      return new Response(
        JSON.stringify({
          success: true,
          message: '✅ Đã tạo sản phẩm đơn giản trên TPOS và lưu vào database',
          variant_count: 0,
          data: {
            tpos: {
              product_id: tposData.Id,
              product_code: tposData.DefaultCode,
              variant_count: 0
            },
            database: {
              parent_saved: 1,
              children_saved: 0
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ CASE 2: PRODUCT WITH VARIANTS ============
    console.log('🔹 Creating product WITH variants:', baseProductCode);
    console.log('Product name:', productName);
    console.log('Prices to send to TPOS:', { purchasePrice, sellingPrice });
    console.log('Selected attribute value IDs:', selectedAttributeValueIds);

    // ✅ OPTIMIZED: Single query with JOIN instead of 2 separate queries
    // Fetch attribute values WITH their parent attributes in one query
    const { data: attributeValuesWithAttrs, error: valuesError } = await supabase
      .from('product_attribute_values')
      .select(`
        id,
        value,
        code,
        tpos_id,
        tpos_attribute_id,
        sequence,
        name_get,
        attribute_id,
        product_attributes!attribute_id (
          id,
          name,
          display_order
        )
      `)
      .in('id', selectedAttributeValueIds);

    if (valuesError || !attributeValuesWithAttrs || attributeValuesWithAttrs.length === 0) {
      console.error('Failed to fetch attribute values:', valuesError);
      throw new Error('Failed to fetch attribute values');
    }

    console.log('✅ Attribute values with attributes fetched in single query:', attributeValuesWithAttrs.length);

    // Extract attributes from JOIN result and deduplicate
    const attributesMap = new Map();
    const attributeValues: AttributeValue[] = [];

    for (const item of attributeValuesWithAttrs) {
      // Add attribute to map (auto-dedup by id)
      if (item.product_attributes && !attributesMap.has(item.product_attributes.id)) {
        attributesMap.set(item.product_attributes.id, {
          id: item.product_attributes.id,
          name: item.product_attributes.name,
          display_order: item.product_attributes.display_order
        });
      }

      // Build attribute value object
      attributeValues.push({
        id: item.id,
        value: item.value,
        code: item.code,
        tpos_id: item.tpos_id,
        tpos_attribute_id: item.tpos_attribute_id,
        sequence: item.sequence,
        name_get: item.name_get,
        attribute_id: item.attribute_id
      });
    }

    // Convert map to array and sort by display_order
    const attributes = Array.from(attributesMap.values())
      .sort((a, b) => a.display_order - b.display_order);

    if (attributes.length === 0) {
      throw new Error('No attributes found in joined data');
    }

    console.log('✅ Processed attributes:', attributes.length);

    // Map attribute names
    const attributeMap = new Map(attributes.map(a => [a.id, a]));

    // 3. Group values by attribute, theo thứ tự selectedAttributeValueIds
    const groupedByAttribute: Record<string, AttributeValue[]> = {};
    for (const value of attributeValues) {
      if (!groupedByAttribute[value.attribute_id]) {
        groupedByAttribute[value.attribute_id] = [];
      }
      groupedByAttribute[value.attribute_id].push(value);
    }

    console.log('Grouped by attribute:', Object.keys(groupedByAttribute).length, 'attributes');

    // 4. Generate all combinations theo thứ tự display_order của attributes
    const attributeGroups = attributes
      .map(attr => groupedByAttribute[attr.id])
      .filter(group => group && group.length > 0);
    
    const allCombinations = generateCombinations(attributeGroups);

    console.log('Total combinations:', allCombinations.length);

    // 5. Build AttributeLines theo thứ tự display_order (user selection order)
    const attributeLines = attributes
      .filter(attr => groupedByAttribute[attr.id])
      .map(attr => {
        const values = groupedByAttribute[attr.id];
        const firstValue = values[0];

        return {
          Attribute: {
            Id: firstValue.tpos_attribute_id,
            Name: attr.name,
            Code: attr.name,
            Sequence: null,
            CreateVariant: true
          },
          Values: values.map(v => ({
            Id: v.tpos_id,
            Name: v.value,
            Code: v.code,
            Sequence: v.sequence,
            AttributeId: v.tpos_attribute_id,
            AttributeName: attr.name,
            PriceExtra: null,
            NameGet: v.name_get,
            DateCreated: null
          })),
          AttributeId: firstValue.tpos_attribute_id
        };
      });

    // 6. Build ProductVariants with reversed order for NameGet
    const productVariants = allCombinations.map(combo => {
      // Đảo ngược thứ tự khi tạo tên variant cho NameGet
      const variantName = `${baseProductCode} (${[...combo].reverse().map(v => v.value).join(", ")})`;

      return {
        Id: 0,
        EAN13: null,
        DefaultCode: null,
        NameTemplate: baseProductCode,
        NameNoSign: null,
        ProductTmplId: 0,
        UOMId: 0,
        UOMName: null,
        UOMPOId: 0,
        QtyAvailable: 0,
        VirtualAvailable: 0,
        OutgoingQty: null,
        IncomingQty: null,
        NameGet: variantName,
        POSCategId: null,
        Price: null,
        Barcode: null,
        Image: null,
        ImageUrl: null,
        Thumbnails: [],
        PriceVariant: sellingPrice,
        SaleOK: true,
        PurchaseOK: true,
        DisplayAttributeValues: null,
        LstPrice: 0,
        Active: true,
        ListPrice: 0,
        PurchasePrice: null,
        DiscountSale: null,
        DiscountPurchase: null,
        StandardPrice: 0,
        Weight: 0,
        Volume: null,
        OldPrice: null,
        IsDiscount: false,
        ProductTmplEnableAll: false,
        Version: 0,
        Description: null,
        LastUpdated: null,
        Type: "product",
        CategId: 0,
        CostMethod: null,
        InvoicePolicy: "order",
        Variant_TeamId: 0,
        Name: variantName,
        PropertyCostMethod: null,
        PropertyValuation: null,
        PurchaseMethod: "receive",
        SaleDelay: 0,
        Tracking: null,
        Valuation: null,
        AvailableInPOS: true,
        CompanyId: null,
        IsCombo: null,
        NameTemplateNoSign: baseProductCode,
        TaxesIds: [],
        StockValue: null,
        SaleValue: null,
        PosSalesCount: null,
        Factor: null,
        CategName: null,
        AmountTotal: null,
        NameCombos: [],
        RewardName: null,
        Product_UOMId: null,
        Tags: null,
        DateCreated: null,
        InitInventory: 0,
        OrderTag: null,
        StringExtraProperties: null,
        CreatedById: null,
        TaxAmount: null,
        Error: null,
        // AttributeValues giữ nguyên thứ tự user chọn (không đảo ngược)
        AttributeValues: combo.map(v => {
          const attr = attributeMap.get(v.attribute_id);
          return {
            Id: v.tpos_id,
            Name: v.value,
            Code: null,
            Sequence: null,
            AttributeId: v.tpos_attribute_id,
            AttributeName: attr?.name || '',
            PriceExtra: null,
            NameGet: v.name_get,
            DateCreated: null
          };
        })
      };
    });

    // 7. Build full payload
    const payload = {
      Id: 0,
      Name: productName,
      NameNoSign: null,
      Description: null,
      Type: "product",
      ShowType: "Có thể lưu trữ",
      ListPrice: sellingPrice,
      DiscountSale: 0,
      DiscountPurchase: 0,
      PurchasePrice: purchasePrice,
      StandardPrice: 0,
      SaleOK: true,
      PurchaseOK: true,
      Active: true,
      UOMId: 1,
      UOMName: null,
      UOMPOId: 1,
      UOMPOName: null,
      UOSId: null,
      IsProductVariant: false,
      EAN13: null,
      DefaultCode: baseProductCode,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: 0,
      IncomingQty: 0,
      PropertyCostMethod: null,
      CategId: 2,
      CategCompleteName: null,
      CategName: null,
      Weight: 0,
      Tracking: "none",
      DescriptionPurchase: null,
      DescriptionSale: null,
      CompanyId: 1,
      NameGet: null,
      PropertyStockProductionId: null,
      SaleDelay: 0,
      InvoicePolicy: "order",
      PurchaseMethod: "receive",
      PropertyValuation: null,
      Valuation: null,
      AvailableInPOS: true,
      POSCategId: null,
      CostMethod: null,
      Barcode: baseProductCode,
      Image: imageBase64,
      ImageUrl: null,
      Thumbnails: [],
      ProductVariantCount: productVariants.length,
      LastUpdated: null,
      UOMCategId: null,
      BOMCount: 0,
      Volume: null,
      CategNameNoSign: null,
      UOMNameNoSign: null,
      UOMPONameNoSign: null,
      IsCombo: false,
      EnableAll: false,
      ComboPurchased: null,
      TaxAmount: null,
      Version: 0,
      VariantFirstId: null,
      VariantFistId: null,
      ZaloProductId: null,
      CompanyName: null,
      CompanyNameNoSign: null,
      DateCreated: null,
      InitInventory: 0,
      UOMViewId: null,
      ImporterId: null,
      ImporterName: null,
      ImporterAddress: null,
      ProducerId: null,
      ProducerName: null,
      ProducerAddress: null,
      DistributorId: null,
      DistributorName: null,
      DistributorAddress: null,
      OriginCountryId: null,
      OriginCountryName: null,
      InfoWarning: null,
      Element: null,
      YearOfManufacture: null,
      Specifications: null,
      Tags: null,
      CreatedByName: null,
      OrderTag: null,
      StringExtraProperties: null,
      CreatedById: null,
      Error: null,
      UOM: {
        Id: 1,
        Name: "Cái",
        NameNoSign: null,
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị",
        Description: null,
        ShowUOMType: "Đơn vị gốc của nhóm này",
        NameGet: "Cái",
        ShowFactor: 1,
        DateCreated: "2018-05-25T15:44:44.14+07:00"
      },
      Categ: {
        Id: 2,
        Name: "Có thể bán",
        CompleteName: "Có thể bán",
        ParentId: null,
        ParentCompleteName: null,
        ParentLeft: 0,
        ParentRight: 1,
        Sequence: null,
        Type: "normal",
        AccountIncomeCategId: null,
        AccountExpenseCategId: null,
        StockJournalId: null,
        StockAccountInputCategId: null,
        StockAccountOutputCategId: null,
        StockValuationAccountId: null,
        PropertyValuation: null,
        PropertyCostMethod: "average",
        NameNoSign: "Co the ban",
        IsPos: true,
        Version: null,
        IsDelete: false
      },
      UOMPO: {
        Id: 1,
        Name: "Cái",
        NameNoSign: null,
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị",
        Description: null,
        ShowUOMType: "Đơn vị gốc của nhóm này",
        NameGet: "Cái",
        ShowFactor: 1,
        DateCreated: "2018-05-25T15:44:44.14+07:00"
      },
      AttributeLines: attributeLines,
      Items: [],
      UOMLines: [],
      ComboProducts: [],
      ProductSupplierInfos: [],
      ProductVariants: productVariants
    };

    console.log('Payload built, posting to TPOS...');
    console.log('AttributeLines:', attributeLines.length);
    console.log('ProductVariants:', productVariants.length);

    // 9. Get TPOS token
    const { data: credentials, error: credError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (credError || !credentials?.bearer_token) {
      throw new Error('TPOS credentials not found');
    }

    // 10. POST to TPOS using InsertV2 endpoint
    const tposUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
    console.log('Posting to TPOS URL:', tposUrl);
    
    const tposResponse = await fetch(tposUrl, {
      method: 'POST',
      headers: getTPOSHeaders(credentials.bearer_token),
      body: JSON.stringify(payload)
    });

    if (!tposResponse.ok) {
      const errorText = await tposResponse.text();
      console.error('❌ TPOS API Error (Product with Variants):');
      console.error('Status:', tposResponse.status);
      console.error('Status Text:', tposResponse.statusText);
      console.error('Response:', errorText);
      console.error('Product Code:', baseProductCode);
      console.error('Variant Count:', productVariants.length);

      // Check if error is due to duplicate product (already exists)
      const isDuplicateError = errorText.includes('đã tồn tại') ||
                               errorText.includes('already exists') ||
                               errorText.includes('Đã có sản phẩm với mã vạch');

      if (isDuplicateError && tposResponse.status === 400) {
        console.warn(`⚠️ Product ${baseProductCode} already exists on TPOS, treating as success`);

        // Return success response (product already exists = success)
        return new Response(
          JSON.stringify({
            success: true,
            message: `✅ Sản phẩm ${baseProductCode} đã tồn tại trên TPOS`,
            product_code: baseProductCode,
            variant_count: productVariants.length,
            already_exists: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      throw new Error(`TPOS API error [${tposResponse.status}]: ${errorText.substring(0, 500)}`);
    }

    const tposData = await tposResponse.json();
    console.log('TPOS response received, product ID:', tposData.Id);

    // ============ SAVE TO SUPABASE ============
    console.log('Starting to save products to Supabase...');

    // 1. Reuse cached image
    const tposImageBase64 = imageBase64; // Reuse cached image

    // 2. Parse parent variant
    const parentVariant = parseParentVariant(tposData.ProductVariants || []);
    console.log('Parsed parent variant:', parentVariant);

    // 3. Construct parent product
    const parentProduct = {
      product_code: tposData.DefaultCode,
      base_product_code: tposData.DefaultCode,
      tpos_product_id: tposData.Id,
      product_name: tposData.Name,
      variant: parentVariant,
      selling_price: tposData.ListPrice,
      purchase_price: tposData.PurchasePrice,
      stock_quantity: tposData.QtyAvailable || 0,
      virtual_available: tposData.VirtualAvailable || 0,
      product_images: productImages,
      supplier_name: supplierName
    };

    console.log('Parent product constructed:', {
      product_code: parentProduct.product_code,
      product_name: parentProduct.product_name,
      variant: parentProduct.variant,
      selling_price: parentProduct.selling_price,
      purchase_price: parentProduct.purchase_price
    });

    // 4. Construct child products
    const childProducts = (tposData.ProductVariants || []).map((variant: any) => {
      const childVariant = parseChildVariant(variant.Name);
      return {
        product_code: variant.DefaultCode,
        base_product_code: tposData.DefaultCode,
        productid_bienthe: variant.Id,
        tpos_product_id: variant.ProductTmplId,
        product_name: variant.Name,
        variant: childVariant,
        selling_price: variant.PriceVariant,
        purchase_price: tposData.PurchasePrice,
        stock_quantity: variant.QtyAvailable || 0,
        virtual_available: variant.VirtualAvailable || 0,
        product_images: productImages,
        supplier_name: supplierName
      };
    });

    console.log('Child products constructed:', childProducts.length);
    if (childProducts.length > 0) {
      console.log('💰 Sample child product price:', {
        variant: childProducts[0].variant,
        selling_price: childProducts[0].selling_price,
        purchase_price: childProducts[0].purchase_price
      });
    }

    // ✅ OPTIMIZED: Parallel upsert parent & children for better performance
    // 5. Upsert to Supabase (parent and children in parallel)
    try {
      console.log('Upserting parent and children products in parallel...');

      // Build array of promises to run in parallel
      const upsertPromises = [
        // Always upsert parent
        supabase
          .from('products')
          .upsert(parentProduct, {
            onConflict: 'product_code',
            ignoreDuplicates: false
          })
      ];

      // Add children upsert if there are children
      if (childProducts.length > 0) {
        upsertPromises.push(
          supabase
            .from('products')
            .upsert(childProducts, {
              onConflict: 'product_code',
              ignoreDuplicates: false
            })
        );
      }

      // Execute all upserts in parallel
      const results = await Promise.all(upsertPromises);

      // Check for errors
      const parentError = results[0].error;
      if (parentError) {
        console.error('Parent product upsert failed:', parentError);
        throw parentError;
      }

      console.log('✓ Parent product saved successfully');

      if (childProducts.length > 0) {
        const childError = results[1].error;
        if (childError) {
          console.error('Child products upsert failed:', childError);
          throw childError;
        }
        console.log(`✓ ${childProducts.length} child products saved successfully (parallel)`);
      }

    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      console.error('Database operation failed:', errorMessage);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database save failed: ${errorMessage}`,
          tpos_product_id: tposData.Id,
          tposData: tposData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 6. Success response
    console.log('All operations completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Đã tạo ${productVariants.length} biến thể trên TPOS và lưu vào database`,
        data: {
          tpos: {
            product_id: tposData.Id,
            product_code: tposData.DefaultCode,
            variant_count: tposData.ProductVariants?.length || 0
          },
          database: {
            parent_saved: 1,
            children_saved: childProducts.length
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // ✅ IMPROVED ERROR LOGGING - Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('❌ Error in create-tpos-variants-from-order:');
    console.error('Error message:', errorMessage);
    console.error('Error stack:', errorStack);
    console.error('Error object:', error);

    // Include more context in the error response
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        context: {
          function: 'create-tpos-variants-from-order',
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
