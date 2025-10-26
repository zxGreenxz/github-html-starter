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

// Convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
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
      purchasePrice,
      sellingPrice,
      productImages,
      supplierName,
      selectedAttributeValueIds 
    } = await req.json();

    if (!baseProductCode || !productName || !selectedAttributeValueIds || selectedAttributeValueIds.length === 0) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Creating TPOS variants from order for:', baseProductCode);
    console.log('Product name:', productName);
    console.log('Selected attribute value IDs:', selectedAttributeValueIds);

    // 1. Query attribute values
    const { data: attributeValues, error: valuesError } = await supabase
      .from('product_attribute_values')
      .select('id, value, code, tpos_id, tpos_attribute_id, sequence, name_get, attribute_id')
      .in('id', selectedAttributeValueIds);

    if (valuesError || !attributeValues || attributeValues.length === 0) {
      throw new Error('Failed to fetch attribute values');
    }

    console.log('Attribute values found:', attributeValues.length);

    // 2. Query attributes để lấy tên và display_order
    const attributeIds = [...new Set(attributeValues.map(v => v.attribute_id))];
    const { data: attributes, error: attrError } = await supabase
      .from('product_attributes')
      .select('id, name, display_order')
      .in('id', attributeIds)
      .order('display_order', { ascending: true });

    if (attrError || !attributes) {
      throw new Error('Failed to fetch attributes');
    }

    console.log('Attributes found:', attributes.length);

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

    // 7. Convert image to base64 if available
    let imageBase64: string | null = null;
    if (productImages && productImages.length > 0) {
      console.log('Converting product image to base64...');
      imageBase64 = await imageUrlToBase64(productImages[0]);
    }

    // 8. Build full payload
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
      console.error('TPOS API Error:', errorText);
      throw new Error(`TPOS API error: ${tposResponse.status} - ${errorText}`);
    }

    const tposData = await tposResponse.json();
    console.log('TPOS response received, product ID:', tposData.Id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Đã tạo ${productVariants.length} biến thể trên TPOS`,
        tpos_product_id: tposData.Id,
        variant_count: productVariants.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-tpos-variants-from-order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
