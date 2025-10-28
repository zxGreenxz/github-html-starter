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
  productTmplId?: number
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
      Id: 0, // New variant
      EAN13: null,
      DefaultCode: null,
      NameTemplate: productName,
      NameNoSign: null,
      ProductTmplId: productTmplId || 0,
      UOMId: 1,
      UOMName: null,
      UOMPOId: 1,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      NameGet: `${productName} (${variantName})`,
      POSCategId: null,
      Price: null,
      Barcode: null,
      Image: imageBase64 || null,
      ImageUrl: null,
      Thumbnails: [],
      PriceVariant: listPrice,
      SaleOK: true,
      PurchaseOK: true,
      DisplayAttributeValues: null,
      LstPrice: 0,
      Active: true,
      ListPrice: 0,
      PurchasePrice: null,
      DiscountSale: null,
      DiscountPurchase: null,
      StandardPrice: listPrice,
      Weight: 0,
      Volume: null,
      OldPrice: null,
      IsDiscount: false,
      ProductTmplEnableAll: false,
      Version: 0,
      Description: null,
      LastUpdated: null,
      DateCreated: null,
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
