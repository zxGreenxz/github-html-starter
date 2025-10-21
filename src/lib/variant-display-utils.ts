/**
 * Format variant for display in ProductList
 * Handles both old format "A, B, C" and new format "(A B) (C D)"
 */
export function formatVariantForDisplay(
  variant: string | null | undefined
): string {
  if (!variant || !variant.trim()) return '';
  
  const trimmed = variant.trim();
  
  // ✅ Already in new format (contains parentheses)
  if (trimmed.includes('(') && trimmed.includes(')')) {
    return trimmed;
  }
  
  // ⚠️ Old format (comma-separated) → Convert to grouped format
  // "Đen, Trắng, S, M, L" → "(Đen Trắng S M L)"
  const values = trimmed
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  
  if (values.length === 0) return '';
  
  // Simple grouping: wrap all values in one group
  // Note: We can't perfectly reconstruct attribute groups from flat text
  return `(${values.join(' ')})`;
}
