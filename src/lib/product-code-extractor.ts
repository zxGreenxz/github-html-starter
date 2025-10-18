/**
 * Extract product codes from comment message
 * Supports multiple patterns: N123, P45, M800XD, etc.
 * 
 * @param message - Comment message text
 * @returns Array of unique uppercase product codes
 */
export function extractProductCodesFromMessage(message: string): string[] {
  if (!message || typeof message !== 'string') return [];
  
  // Pattern: Chữ cái (1+ ký tự) + số (1+ chữ số) + chữ cái optional (0+ ký tự)
  // Matches: N123, P45VX, M800XXD30, etc.
  const pattern = /\b([A-Z]+\d+[A-Z]*)\b/gi;
  
  const matches = message.match(pattern) || [];
  
  // Remove duplicates, convert to uppercase
  const uniqueCodes = Array.from(new Set(
    matches.map(code => code.toUpperCase())
  ));
  
  return uniqueCodes;
}

/**
 * Format product codes for display
 * @param codes - Array of product codes
 * @returns Formatted string (e.g., "N123, P45, M800")
 */
export function formatProductCodesDisplay(codes: string[]): string {
  return codes.join(', ');
}
