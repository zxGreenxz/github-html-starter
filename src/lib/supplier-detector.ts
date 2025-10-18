/**
 * Supplier Detection Utility
 * Detects supplier name from product name based on Vietnamese naming patterns
 * Pattern: ddmm[Supplier Name]product description
 * Example: "0510 A43 SET ÁO TD" → Supplier: A43
 */

export interface SupplierDetectionResult {
  supplierName: string | null;
  confidence: 'high' | 'medium' | 'low';
  position: number;
}

/**
 * Detects supplier name from product name
 * @param productName - The product name to parse
 * @returns Supplier name or null if not found
 */
export function detectSupplierFromProductName(productName: string): string | null {
  if (!productName || typeof productName !== 'string') {
    return null;
  }

  const normalizedName = productName.trim();

  // Pattern 1: ddmm A## format (most common)
  // Example: "0510 A43 SET ÁO TD" → A43
  const pattern1 = /^\d{4}\s+([A-Z]\d{1,4})\s+/;
  const match1 = normalizedName.match(pattern1);
  if (match1) {
    return match1[1];
  }

  // Pattern 2: [CODE] ddmm A## format
  // Example: "[LQU53A4] 0510 A16 QUẦN SUÔNG" → A16
  const pattern2 = /^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+/;
  const match2 = normalizedName.match(pattern2);
  if (match2) {
    return match2[1];
  }

  // Pattern 3: A## at the start (no date)
  // Example: "A43 SET ÁO TD" → A43
  const pattern3 = /^([A-Z]\d{1,4})\s+/;
  const match3 = normalizedName.match(pattern3);
  if (match3) {
    return match3[1];
  }

  // Pattern 4: Look for A## anywhere in the first part of the name
  // Example: "SET A43 ÁO TD" → A43
  const pattern4 = /\b([A-Z]\d{1,4})\b/;
  const match4 = normalizedName.match(pattern4);
  if (match4) {
    return match4[1];
  }

  return null;
}

/**
 * Detects supplier with confidence score
 * @param productName - The product name to parse
 * @returns Detection result with confidence
 */
export function detectSupplierWithConfidence(productName: string): SupplierDetectionResult {
  if (!productName || typeof productName !== 'string') {
    return { supplierName: null, confidence: 'low', position: -1 };
  }

  const normalizedName = productName.trim();

  // Pattern 1: ddmm A## format (high confidence)
  const pattern1 = /^\d{4}\s+([A-Z]\d{1,4})\s+/;
  const match1 = normalizedName.match(pattern1);
  if (match1) {
    return {
      supplierName: match1[1],
      confidence: 'high',
      position: match1.index || 0,
    };
  }

  // Pattern 2: [CODE] ddmm A## format (high confidence)
  const pattern2 = /^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+/;
  const match2 = normalizedName.match(pattern2);
  if (match2) {
    return {
      supplierName: match2[1],
      confidence: 'high',
      position: match2.index || 0,
    };
  }

  // Pattern 3: A## at the start (medium confidence)
  const pattern3 = /^([A-Z]\d{1,4})\s+/;
  const match3 = normalizedName.match(pattern3);
  if (match3) {
    return {
      supplierName: match3[1],
      confidence: 'medium',
      position: match3.index || 0,
    };
  }

  // Pattern 4: A## anywhere (low confidence)
  const pattern4 = /\b([A-Z]\d{1,4})\b/;
  const match4 = normalizedName.match(pattern4);
  if (match4) {
    return {
      supplierName: match4[1],
      confidence: 'low',
      position: match4.index || 0,
    };
  }

  return { supplierName: null, confidence: 'low', position: -1 };
}

/**
 * Validates if a string looks like a supplier name
 * @param supplierName - The string to validate
 * @returns true if it looks like a supplier name
 */
export function isValidSupplierName(supplierName: string): boolean {
  if (!supplierName) return false;
  // Supplier names: A1-A1000, B1-B1000, etc.
  const pattern = /^[A-Z]\d{1,4}$/;
  return pattern.test(supplierName);
}
