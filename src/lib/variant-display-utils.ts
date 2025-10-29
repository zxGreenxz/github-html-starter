/**
 * Format variant for display in ProductList
 * Converts: "(1 | 2) (Nude | Nâu | Hồng)" → "1 | 2 | Nude | Nâu | Hồng"
 */
export function formatVariantForDisplay(
  variant: string | null | undefined
): string {
  if (!variant || !variant.trim()) return '';
  
  const trimmed = variant.trim();
  
  // New format: "(1 | 2) (Nude | Nâu | Hồng)"
  if (trimmed.includes('(') && trimmed.includes(')')) {
    // Step 1: Remove parentheses → "1 | 2  Nude | Nâu | Hồng"
    let result = trimmed.replace(/[()]/g, '');
    
    // Step 2: Replace multiple spaces with " | "
    // "1 | 2  Nude | Nâu | Hồng" → "1 | 2 | Nude | Nâu | Hồng"
    result = result.replace(/\s{2,}/g, ' | ').trim();
    
    return result;
  }
  
  // Legacy format fallback
  return trimmed;
}
