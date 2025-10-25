// Compatibility exports for variant-related functions
// These functions are no longer used with the new variant generator

/**
 * @deprecated Use the new variant generator instead
 */
export function generateColorCode(color: string): string {
  // Simple fallback - take first letter uppercase
  return color.charAt(0).toUpperCase();
}

/**
 * @deprecated Use the new variant generator instead
 */
export function generateVariantCode(variant: string): string {
  // Simple fallback
  return variant.replace(/\s+/g, '').toUpperCase();
}

/**
 * @deprecated Use the new variant generator instead
 */
export function generateProductName(baseName: string, variant: string): string {
  return `${baseName} ${variant}`;
}

/**
 * @deprecated Use the new variant generator instead
 */
export function generateProductNameWithVariant(baseName: string, variant: string): string {
  return `${baseName} (${variant})`;
}
