import { supabase } from "@/integrations/supabase/client";

/**
 * Convert selectedVariants string "(Đỏ | Xanh | Size M)" 
 * to TPOS AttributeLines format
 */
export async function convertVariantsToAttributeLines(
  selectedVariants: string
): Promise<any[]> {
  if (!selectedVariants || selectedVariants === "") return [];
  
  // Parse selected variant names: "(Đỏ | Xanh | Size M)"
  const match = selectedVariants.match(/\((.*?)\)/);
  if (!match) return [];
  
  const variantNames = match[1].split("|").map(s => s.trim());
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
    console.error("Error fetching attribute values:", error);
    return [];
  }
  
  // Group by attribute
  const attributeMap: Record<string, any> = {};
  
  attributeValues.forEach(av => {
    const attrId = av.tpos_attribute_id;
    const attrName = av.product_attributes.name;
    
    if (!attrId) return; // Skip if no TPOS mapping
    
    if (!attributeMap[attrId]) {
      attributeMap[attrId] = {
        Attribute: {
          Id: attrId,
          Name: attrName,
          Code: null,
          Sequence: av.product_attributes.display_order,
          CreateVariant: true,
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
  
  return Object.values(attributeMap);
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
    
    return {
      // ✅ Basic identity fields
      Id: 0, // New variant
      EAN13: null,
      DefaultCode: null,
      NameTemplate: productName,
      Name: `${productName} (${variantName})`,
      NameNoSign: null,
      NameGet: `${productName} (${variantName})`,
      NameTemplateNoSign: productName,
      
      // ✅ Product template reference
      ProductTmplId: productTmplId || 0,
      
      // ✅ Unit of measure
      UOMId: baseProduct?.UOMId || 1,
      UOMName: null,
      UOMPOId: baseProduct?.UOMPOId || 1,
      Product_UOMId: null,
      
      // ✅ Inventory
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      InitInventory: 0,
      StockValue: null,
      
      // ✅ Category & Position
      POSCategId: baseProduct?.POSCategId || null,
      CategId: baseProduct?.CategId || 0,
      CategName: null,
      AvailableInPOS: baseProduct?.AvailableInPOS ?? true,
      
      // ✅ Pricing
      Price: null,
      ListPrice: 0,
      LstPrice: 0,
      PriceVariant: listPrice,
      StandardPrice: listPrice,
      PurchasePrice: null,
      OldPrice: null,
      DiscountSale: null,
      DiscountPurchase: null,
      
      // ✅ Barcode & Images
      Barcode: null,
      Image: imageBase64 || null,
      ImageUrl: null,
      Thumbnails: [],
      
      // ✅ Sales & Purchase flags
      SaleOK: baseProduct?.SaleOK ?? true,
      PurchaseOK: baseProduct?.PurchaseOK ?? true,
      Active: baseProduct?.Active ?? true,
      
      // ✅ Product type & tracking
      Type: baseProduct?.Type || "product",
      Tracking: baseProduct?.Tracking || null,
      
      // ✅ Costing & valuation
      CostMethod: baseProduct?.CostMethod || null,
      PropertyCostMethod: baseProduct?.PropertyCostMethod || null,
      Valuation: baseProduct?.Valuation || null,
      PropertyValuation: baseProduct?.PropertyValuation || null,
      
      // ✅ Policies
      InvoicePolicy: baseProduct?.InvoicePolicy || "order",
      PurchaseMethod: baseProduct?.PurchaseMethod || "receive",
      
      // ✅ Physical properties
      Weight: baseProduct?.Weight || 0,
      Volume: baseProduct?.Volume || null,
      
      // ✅ Miscellaneous
      DisplayAttributeValues: null,
      IsDiscount: false,
      ProductTmplEnableAll: false,
      Version: 0,
      Description: null,
      LastUpdated: null,
      DateCreated: null,
      IsCombo: baseProduct?.IsCombo || null,
      Variant_TeamId: 0,
      SaleDelay: baseProduct?.SaleDelay || 0,
      CompanyId: baseProduct?.CompanyId || null,
      
      // ✅ Tax & additional data
      TaxesIds: baseProduct?.TaxesIds || [],
      Tags: null,
      OrderTag: null,
      StringExtraProperties: null,
      CreatedById: null,
      TaxAmount: null,
      Error: null,
      
      // ✅ Sales tracking
      SaleValue: null,
      PosSalesCount: null,
      AmountTotal: null,
      
      // ✅ Combos & rewards
      NameCombos: [],
      RewardName: null,
      Factor: null,
      
      // ✅ CRITICAL: AttributeValues array
      AttributeValues: attrs.map(a => ({
        Id: a.Id,
        Name: a.Name,
        Code: a.Code,
        Sequence: a.Sequence,
        AttributeId: a.AttributeId,
        AttributeName: a.AttributeName,
        PriceExtra: a.PriceExtra,
        NameGet: a.NameGet,
        DateCreated: a.DateCreated,
      })),
    };
  });
}
