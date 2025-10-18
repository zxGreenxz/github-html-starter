/**
 * Apply multi-keyword search to Supabase query
 * 
 * @param query - Supabase query builder
 * @param searchTerm - User input search term
 * @param searchFields - Array of fields to search (e.g., ['product_name', 'product_code', 'barcode'])
 * @returns Modified query with search conditions
 * 
 * @example
 * // Single keyword: OR search across all fields
 * applyMultiKeywordSearch(query, "N123", ['product_name', 'product_code', 'barcode'])
 * // => product_code LIKE '%N123%' OR product_name LIKE '%N123%' OR barcode LIKE '%N123%'
 * 
 * // Multiple keywords: ALL must be present in primary field (first field)
 * applyMultiKeywordSearch(query, "áo xanh", ['product_name', 'product_code'])
 * // => product_name LIKE '%áo%' AND product_name LIKE '%xanh%'
 */
export function applyMultiKeywordSearch(
  query: any,
  searchTerm: string,
  searchFields: string[]
) {
  const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
  
  if (keywords.length === 0) return query;
  
  if (keywords.length === 1) {
    // Single keyword: OR search across all fields
    const conditions = searchFields
      .map(field => `${field}.ilike.%${keywords[0]}%`)
      .join(',');
    return query.or(conditions);
  } else {
    // Multiple keywords: ALL must be present in primary field (first field)
    const primaryField = searchFields[0];
    keywords.forEach(keyword => {
      query = query.ilike(primaryField, `%${keyword}%`);
    });
    return query;
  }
}
