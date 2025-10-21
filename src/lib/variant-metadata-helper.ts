import type { TPOSAttributeLine } from "./variant-generator";
import { parseVariantStringToAttributeLines } from "./variant-generator-adapter";

/**
 * Get AttributeLines from product - prioritize variant_metadata over variant text
 */
export function getAttributeLinesFromProduct(
  variant_metadata: TPOSAttributeLine[] | null | undefined,
  variant_text: string | null | undefined
): TPOSAttributeLine[] {
  // Priority 1: Use variant_metadata if available
  if (variant_metadata && Array.isArray(variant_metadata) && variant_metadata.length > 0) {
    console.log('✅ Using variant_metadata for TPOS upload');
    return variant_metadata;
  }
  
  // Priority 2: Parse variant text as fallback
  if (variant_text && variant_text.trim()) {
    console.log('⚠️ Fallback to parsing variant text');
    return parseVariantStringToAttributeLines(variant_text);
  }
  
  // No variants
  console.log('ℹ️ No variants found');
  return [];
}
