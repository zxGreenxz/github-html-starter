import type { TPOSAttributeLine } from "./variant-generator";
import { parseVariantStringToAttributeLines } from "./variant-generator-adapter";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get AttributeLines - prioritize variant_metadata (EXACT TPOS format)
 * 
 * Priority:
 * 1. variant_metadata (exact TPOS structure) - 100% accurate
 * 2. variant_text (parsed) - may have inaccuracies
 */
export function getAttributeLinesFromProduct(
  variant_metadata: TPOSAttributeLine[] | null | undefined,
  variant_text: string | null | undefined
): TPOSAttributeLine[] {
  // ✅ Priority 1: Use variant_metadata (EXACT TPOS format)
  if (variant_metadata && Array.isArray(variant_metadata) && variant_metadata.length > 0) {
    console.log('✅ Using variant_metadata (100% TPOS format)');
    return variant_metadata;
  }
  
  // ⚠️ Priority 2: Parse variant text (may be inaccurate)
  if (variant_text && variant_text.trim()) {
    console.warn('⚠️ Fallback to parsing variant text - may not be 100% accurate');
    return parseVariantStringToAttributeLines(variant_text);
  }
  
  console.log('ℹ️ No variants found');
  return [];
}

/**
 * Save AttributeLines to product for future uploads (100% accuracy)
 */
export async function saveVariantMetadata(
  productCode: string,
  attributeLines: TPOSAttributeLine[]
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      variant_metadata: attributeLines as any
    })
    .eq('product_code', productCode)
    .eq('base_product_code', productCode); // Only update parent
    
  if (error) {
    console.error('Failed to save variant_metadata:', error);
    throw error;
  }
  
  console.log('✅ Saved variant_metadata for', productCode);
}
