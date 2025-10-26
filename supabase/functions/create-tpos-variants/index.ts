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
  tpos_id?: number;
}

interface Product {
  product_name: string;
  product_code: string;
  selling_price: number;
  purchase_price: number;
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
    const { baseProductCode, selectedAttributeValueIds } = await req.json();

    if (!baseProductCode || !selectedAttributeValueIds || selectedAttributeValueIds.length === 0) {
      throw new Error('Missing required parameters: baseProductCode and selectedAttributeValueIds');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Creating TPOS variants for:', baseProductCode);
    console.log('Selected attribute value IDs:', selectedAttributeValueIds);

    // 1. Query product gốc
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('product_name, product_code, selling_price, purchase_price')
      .eq('product_code', baseProductCode)
      .single();

    if (productError || !product) {
      throw new Error(`Product not found: ${baseProductCode}`);
    }

    console.log('Product found:', product);

    // 2. Query attribute values
    const { data: attributeValues, error: valuesError } = await supabase
      .from('product_attribute_values')
      .select('id, value, code, tpos_id, tpos_attribute_id, sequence, name_get, attribute_id')
      .in('id', selectedAttributeValueIds);

    if (valuesError || !attributeValues || attributeValues.length === 0) {
      throw new Error('Failed to fetch attribute values');
    }

    console.log('Attribute values found:', attributeValues.length);

    // 3. Query attributes để lấy tên
    const attributeIds = [...new Set(attributeValues.map(v => v.attribute_id))];
    const { data: attributes, error: attrError } = await supabase
      .from('product_attributes')
      .select('id, name')
      .in('id', attributeIds);

    if (attrError || !attributes) {
      throw new Error('Failed to fetch attributes');
    }

    console.log('Attributes found:', attributes.length);

    // Map attribute names
    const attributeMap = new Map(attributes.map(a => [a.id, a]));

    // 4. Group values by attribute
    const groupedByAttribute: Record<string, AttributeValue[]> = {};
    for (const value of attributeValues) {
      if (!groupedByAttribute[value.attribute_id]) {
        groupedByAttribute[value.attribute_id] = [];
      }
      groupedByAttribute[value.attribute_id].push(value);
    }

    console.log('Grouped by attribute:', Object.keys(groupedByAttribute).length, 'attributes');

    // 5. Generate all combinations
    const attributeGroups = Object.values(groupedByAttribute);
    const allCombinations = generateCombinations(attributeGroups);

    console.log('Total combinations:', allCombinations.length);

    // 6. Build AttributeLines
    const attributeLines = Object.keys(groupedByAttribute).map(attrId => {
      const attr = attributeMap.get(attrId);
      const values = groupedByAttribute[attrId];
      const firstValue = values[0];

      return {
        Attribute: {
          Id: firstValue.tpos_attribute_id,
          Name: attr?.name || '',
          Code: attr?.name || '',
          Sequence: null,
          CreateVariant: true
        },
        Values: values.map(v => ({
          Id: v.tpos_id,
          Name: v.value,
          Code: v.code,
          Sequence: v.sequence,
          AttributeId: v.tpos_attribute_id,
          AttributeName: attr?.name || '',
          PriceExtra: null,
          NameGet: v.name_get,
          DateCreated: null
        })),
        AttributeId: firstValue.tpos_attribute_id
      };
    });

    // 7. Build ProductVariants
    const productVariants = allCombinations.map(combo => {
      const variantName = `${product.product_name} (${combo.map(v => v.value).join(", ")})`;

      return {
        Id: 0,
        Name: variantName,
        NameGet: variantName,
        NameTemplate: product.product_name,
        NameTemplateNoSign: product.product_name,
        ListPrice: 0,
        PurchasePrice: null,
        Active: true,
        SaleOK: true,
        PurchaseOK: true,
        DefaultCode: null,
        ProductTmplId: 0,
        UOMId: 0,
        CategId: 0,
        Tracking: null,
        Type: "product",
        InvoicePolicy: "order",
        PurchaseMethod: "receive",
        AvailableInPOS: true,
        PriceVariant: product.selling_price,
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

    // 8. Build full payload
    const payload = {
      Id: 0,
      Name: product.product_name,
      DefaultCode: baseProductCode,
      Type: "product",
      ListPrice: product.selling_price,
      PurchasePrice: product.purchase_price,
      Active: true,
      SaleOK: true,
      PurchaseOK: true,
      CategId: 2,
      UOMId: 1,
      UOMPOId: 1,
      Tracking: "none",
      InvoicePolicy: "order",
      PurchaseMethod: "receive",
      AvailableInPOS: true,
      Barcode: baseProductCode,
      UOM: {
        Id: 1,
        Name: "Cái",
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị",
        ShowUOMType: "Đơn vị gốc của nhóm này",
        NameGet: "Cái",
        ShowFactor: 1,
        DateCreated: "2018-05-25T15:44:44.14+07:00"
      },
      Categ: {
        Id: 2,
        Name: "Có thể bán",
        CompleteName: "Có thể bán",
        Type: "normal",
        PropertyCostMethod: "average",
        NameNoSign: "Co the ban",
        IsPos: true
      },
      UOMPO: {
        Id: 1,
        Name: "Cái",
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị",
        ShowUOMType: "Đơn vị gốc của nhóm này",
        NameGet: "Cái",
        ShowFactor: 1,
        DateCreated: "2018-05-25T15:44:44.14+07:00"
      },
      AttributeLines: attributeLines,
      ProductVariants: productVariants,
      Items: [],
      UOMLines: [],
      ComboProducts: [],
      ProductSupplierInfos: []
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

    // 10. POST to TPOS
    const tposResponse = await fetch('https://tomato.tpos.vn/odata/ProductTemplate', {
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
    console.log('TPOS response:', tposData);

    // 11. Update tpos_product_id in database
    if (tposData.Id) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ tpos_product_id: tposData.Id })
        .eq('product_code', baseProductCode);

      if (updateError) {
        console.error('Failed to update tpos_product_id:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tpos_product_id: tposData.Id,
        variants_created: productVariants.length,
        message: `Đã tạo ${productVariants.length} biến thể lên TPOS thành công`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-tpos-variants:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
