import { supabase } from "@/integrations/supabase/client";

/**
 * Convert selectedVariants string "(Đỏ | Xanh | Size M)" 
 * to TPOS AttributeLines format
 */
export async function convertVariantsToAttributeLines(
  selectedVariants: string
): Promise<any[]> {
  if (!selectedVariants || selectedVariants === "") return [];
  
  // Parse TẤT CẢ các nhóm: "(1 | 2 | 3) (Trắng | Đen) (S | M)"
  console.log('🔍 [convertVariantsToAttributeLines] Input:', selectedVariants);
  
  const matches = selectedVariants.match(/\([^)]+\)/g);
  if (!matches) {
    console.warn('⚠️ No variant groups found in:', selectedVariants);
    return [];
  }
  
  console.log('📋 [convertVariantsToAttributeLines] Found groups:', matches);
  
  const variantNames: string[] = [];
  matches.forEach(group => {
    // Remove ( and ) → "1 | 2 | 3"
    const content = group.slice(1, -1);
    const names = content.split("|").map(s => s.trim());
    variantNames.push(...names);
  });
  
  console.log('📋 [convertVariantsToAttributeLines] All variant names:', variantNames);
  
  if (variantNames.length === 0) return [];
  
  // Get attribute values from database
  const { data: attributeValues, error } = await supabase
    .from("product_attribute_values")
    .select(`
      id,
      value,
      attribute_id,
      display_order,
      tpos_id,
      tpos_attribute_id,
      product_attributes!inner(
        id,
        name,
        display_order
      )
    `)
    .in("value", variantNames)
    .eq("is_active", true);
  
  if (error || !attributeValues) {
    console.error("❌ Error fetching attribute values:", error);
    return [];
  }
  
  console.log(`✅ Found ${attributeValues.length} attribute values in DB:`, 
    attributeValues.map(av => `${av.product_attributes.name}: ${av.value}`)
  );
  
  // Group by attribute
  const attributeMap: Record<string, any> = {};
  
  attributeValues.forEach(av => {
    const attrId = av.tpos_attribute_id;
    const attrName = av.product_attributes.name;
    
    if (!attrId) return; // Skip if no TPOS mapping
    
    if (!attributeMap[attrId]) {
      attributeMap[attrId] = {
        // ✅ CHỈ CÓ Id theo file mẫu line 35
        Attribute: {
          Id: attrId
        },
        Values: [],
        AttributeId: attrId,
      };
    }
    
    // Add value
    attributeMap[attrId].Values.push({
      Id: av.tpos_id,
      Name: av.value,
      Code: null,
      Sequence: av.display_order,
      AttributeId: attrId,
      AttributeName: attrName,
      PriceExtra: null,
      NameGet: `${attrName}: ${av.value}`,
      DateCreated: null,
    });
  });
  
  const result = Object.values(attributeMap);
  console.log(`✅ Generated ${result.length} AttributeLines:`,
    result.map(al => `${al.Attribute.Id} (${al.Values.length} values)`)
  );
  
  return result;
}

/**
 * Generate ProductVariants from AttributeLines
 * Giống logic trong updater-2.js lines 584-660
 */
export function generateProductVariants(
  productName: string,
  listPrice: number,
  attributeLines: any[],
  imageBase64?: string,
  productTmplId?: number,
  baseProduct?: any
): any[] {
  if (!attributeLines || attributeLines.length === 0) return [];
  
  const combinations: any[][] = [];
  
  function getCombinations(lines: any[], current: any[] = [], index = 0) {
    if (index === lines.length) {
      combinations.push([...current]);
      return;
    }
    const line = lines[index];
    for (const value of line.Values) {
      current.push(value);
      getCombinations(lines, current, index + 1);
      current.pop();
    }
  }
  
  getCombinations(attributeLines);
  
  return combinations.map((attrs) => {
    const variantName = attrs.map((a) => a.Name).join(", ");
    
    // ✅ THỨ TỰ CHÍNH XÁC 100% THEO FILE MẪU LINE 82 edit-modal-2.js
    return {
      Id: 0,
      EAN13: null,
      DefaultCode: null,
      NameTemplate: productName,
      NameNoSign: null,
      ProductTmplId: productTmplId || 0,
      UOMId: baseProduct?.UOMId || 0,
      UOMName: null,
      UOMPOId: baseProduct?.UOMPOId || 0,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      NameGet: `${productName} (${variantName})`,
      POSCategId: baseProduct?.POSCategId || null,
      Price: null,
      Barcode: null,
      Image: imageBase64 || null,
      ImageUrl: null,
      Thumbnails: [],
      PriceVariant: listPrice,
      SaleOK: baseProduct?.SaleOK ?? true,
      PurchaseOK: baseProduct?.PurchaseOK ?? true,
      DisplayAttributeValues: null,
      LstPrice: 0,
      Active: baseProduct?.Active ?? true,
      ListPrice: 0,
      PurchasePrice: null,
      DiscountSale: null,
      DiscountPurchase: null,
      StandardPrice: baseProduct?.StandardPrice || 0,
      Weight: baseProduct?.Weight || 0,
      Volume: baseProduct?.Volume || null,
      OldPrice: null,
      IsDiscount: false,
      ProductTmplEnableAll: false,
      Version: 0,
      Description: null,
      LastUpdated: null,
      Type: baseProduct?.Type || "product",
      CategId: baseProduct?.CategId || 0,
      CostMethod: baseProduct?.CostMethod || null,
      InvoicePolicy: baseProduct?.InvoicePolicy || "order",
      Variant_TeamId: 0,
      Name: `${productName} (${variantName})`,
      PropertyCostMethod: baseProduct?.PropertyCostMethod || null,
      PropertyValuation: baseProduct?.PropertyValuation || null,
      PurchaseMethod: baseProduct?.PurchaseMethod || "receive",
      SaleDelay: baseProduct?.SaleDelay || 0,
      Tracking: baseProduct?.Tracking || null,
      Valuation: baseProduct?.Valuation || null,
      AvailableInPOS: baseProduct?.AvailableInPOS ?? true,
      CompanyId: baseProduct?.CompanyId || null,
      IsCombo: baseProduct?.IsCombo || null,
      NameTemplateNoSign: productName,
      TaxesIds: baseProduct?.TaxesIds || [],
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
      // ✅ AttributeValues ở CUỐI CÙNG - full objects theo file mẫu
      AttributeValues: attrs
    };
  });
}
