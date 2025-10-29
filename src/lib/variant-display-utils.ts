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
    // Extract each group using regex
    const groups = trimmed.match(/\([^)]+\)/g) || [];
    
    // For each group, remove () and split by " | "
    const allValues = groups.flatMap(group => {
      const content = group.slice(1, -1); // Remove ( and )
      return content.split(' | ').map(v => v.trim());
    });
    
    // Join all values with " | "
    return allValues.filter(v => v).join(' | ');
  }
  
  // Legacy format fallback
  return trimmed;
}
