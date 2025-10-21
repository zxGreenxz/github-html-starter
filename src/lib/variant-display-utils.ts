/**
 * Format variant for display in ProductList
 * Handles both old format "A, B, C" and new format "(A B) (C D)"
 * Removes parentheses and displays values separated by spaces
 */
export function formatVariantForDisplay(
  variant: string | null | undefined
): string {
  if (!variant || !variant.trim()) return '';
  
  const trimmed = variant.trim();
  
  // ✅ New format with parentheses "(A B) (C D)" → Remove parentheses → "A B C D"
  if (trimmed.includes('(') && trimmed.includes(')')) {
    return trimmed
      .replace(/[()]/g, '') // Remove all parentheses
      .replace(/\s+/g, ' ') // Normalize whitespace (multiple spaces → single space)
      .trim();
  }
  
  // ⚠️ Old format (comma-separated) → "A, B, C" → "A B C"
  const values = trimmed
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  
  if (values.length === 0) return '';
  
  // Join with spaces, no parentheses
  return values.join(' ');
}
