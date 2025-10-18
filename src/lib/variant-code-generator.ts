/**
 * TPOS Variant Generator Module
 * 
 * Tạo mã variant tự động theo logic:
 * - Size Chữ: Lấy chữ cái đầu tiên (XL → X, XXL → X, M → M)
 * - Màu: Lấy chữ cái đầu của mỗi từ (Xanh Đậu → XD, Cam → C)
 * - Size Số: Giữ nguyên (29, 30, 32)
 * - Collision: Sequential suffix 1, 12, 123, 1234...
 * 
 * Format: ProductCode + SizeCode + ColorCode + SizeNumber + Suffix
 * Example: M800 + X + XD + 30 = M800XXD30
 */

import { convertVietnameseToUpperCase } from './utils';

/**
 * Normalize Vietnamese text - Remove diacritics and special characters
 */
export function normalizeVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Generate size code from size text
 * @param sizeText - Size text (e.g., "XL", "XXL", "M")
 * @returns Size code (first letter only)
 */
export function generateSizeCode(sizeText: string): string {
  const normalized = normalizeVietnamese(sizeText);
  return normalized.charAt(0).toUpperCase();
}

/**
 * Generate color code from color name
 * @param colorName - Color name (e.g., "Xanh Đậu", "Cam")
 * @returns Color code (first letter of each word)
 */
export function generateColorCode(colorName: string): string {
  const normalized = normalizeVietnamese(colorName);
  const colorWords = normalized.split(/\s+/);
  return colorWords.map(w => w.charAt(0).toUpperCase()).join('');
}

/**
 * Variant parts
 */
export interface VariantParts {
  sizeText?: string;
  color?: string;
  sizeNumber?: string;
}

/**
 * Combination object
 */
export interface Combination {
  text: string;
  parts: VariantParts;
}

/**
 * Create cartesian product of arrays
 */
export function createCartesianProduct({
  sizeTexts = [],
  colors = [],
  sizeNumbers = []
}: {
  sizeTexts?: string[];
  colors?: string[];
  sizeNumbers?: string[];
}): Combination[] {
  let combinations: Combination[] = [{ text: '', parts: {} }];

  // Add colors first
  if (colors.length > 0) {
    const newCombinations: Combination[] = [];
    for (const base of combinations) {
      for (const color of colors) {
        newCombinations.push({
          text: base.text ? `${base.text}, ${color}` : color,
          parts: { ...base.parts, color }
        });
      }
    }
    combinations = newCombinations;
  }

  // Add size texts
  if (sizeTexts.length > 0) {
    const newCombinations: Combination[] = [];
    for (const base of combinations) {
      for (const size of sizeTexts) {
        newCombinations.push({
          text: base.text ? `${base.text}, ${size}` : size,
          parts: { ...base.parts, sizeText: size }
        });
      }
    }
    combinations = newCombinations;
  }

  // Add size numbers
  if (sizeNumbers.length > 0) {
    const newCombinations: Combination[] = [];
    for (const base of combinations) {
      for (const sizeNum of sizeNumbers) {
        newCombinations.push({
          text: base.text ? `${base.text}, ${sizeNum}` : sizeNum,
          parts: { ...base.parts, sizeNumber: sizeNum }
        });
      }
    }
    combinations = newCombinations;
  }

  return combinations;
}

/**
 * Generate product name with variant details
 * Format: baseName (sizeNumber, color, sizeText)
 * Example: "Áo Thun (29, Cam, M)"
 */
export function generateProductName(
  baseName: string, 
  { sizeNumber, color, sizeText }: VariantParts
): string {
  const nameParts: string[] = [];
  
  // Logic theo yêu cầu:
  // 1. Màu + Size số (không có Size chữ) → (Size số, Màu)
  // 2. Màu + Size chữ (không có Size số) → (Màu, Size chữ)
  // 3. Màu + Size chữ + Size số → (Size số, Màu, Size chữ)
  // 4. Size chữ + Size số (không có Màu) → (Size số, Size chữ)
  // 5. Chỉ 1 thuộc tính → (thuộc tính đó)
  
  if (color && sizeNumber && sizeText) {
    // Case 3: Cả 3 thuộc tính → (Size số, Màu, Size chữ)
    nameParts.push(sizeNumber, color, sizeText);
  } else if (color && sizeNumber) {
    // Case 1: Màu + Size số → (Size số, Màu)
    nameParts.push(sizeNumber, color);
  } else if (color && sizeText) {
    // Case 2: Màu + Size chữ → (Màu, Size chữ)
    nameParts.push(color, sizeText);
  } else if (sizeNumber && sizeText) {
    // Case 4: Size chữ + Size số → (Size số, Size chữ)
    nameParts.push(sizeNumber, sizeText);
  } else {
    // Case 5: Chỉ 1 thuộc tính
    if (color) nameParts.push(color);
    if (sizeText) nameParts.push(sizeText);
    if (sizeNumber) nameParts.push(sizeNumber);
  }
  
  return nameParts.length > 0 
    ? `${baseName} (${nameParts.join(', ')})`
    : baseName;
}

/**
 * Code info result
 */
export interface CodeInfo {
  variantCode: string;
  fullCode: string;
  baseCode: string;
  hasCollision: boolean;
}

/**
 * Generate variant code with collision handling
 * Returns the variant code and full product code
 */
export function generateVariantCode(
  combo: Combination,
  productCode: string,
  usedCodes: Set<string>,
  codeCollisionCount: Map<string, number>
): CodeInfo {
  let variantCode = '';

  // THỨ TỰ MỚI: Màu → Size chữ → Size số
  
  // 1. Màu: chữ cái đầu của mỗi từ (Đen → D, Xanh Đậu → XD)
  if (combo.parts.color) {
    variantCode += generateColorCode(combo.parts.color);
  }

  // 2. Size chữ: chỉ lấy chữ cái đầu tiên (M → M, XL → X)
  if (combo.parts.sizeText) {
    variantCode += generateSizeCode(combo.parts.sizeText);
  }

  // 3. Size số: giữ nguyên (27, 28, 29)
  // Special case: Nếu chỉ có size số (không có size chữ và màu) 
  // VÀ productCode kết thúc bằng số → thêm "A" trước size số
  if (combo.parts.sizeNumber) {
    const hasOtherAttributes = combo.parts.sizeText || combo.parts.color;
    const productCodeEndsWithNumber = /\d$/.test(productCode);
    
    if (!hasOtherAttributes && productCodeEndsWithNumber) {
      variantCode += `A${combo.parts.sizeNumber}`;
    } else {
      variantCode += combo.parts.sizeNumber;
    }
  }

  // FIXED: Check collision by BASE variant code only, not full product code
  // This ensures that when variants are removed, the remaining ones get correct suffixes
  let finalCode = variantCode;
  let hasCollision = false;

  // Get current count for this base code
  const count = codeCollisionCount.get(variantCode) || 0;
  
  if (count > 0) {
    // Already seen this base code → add sequential suffix
    hasCollision = true;
    let sequentialSuffix = '';
    for (let i = 1; i <= count; i++) {
      sequentialSuffix += i;
    }
    finalCode = variantCode + sequentialSuffix;
  }
  
  // Update count for next occurrence
  codeCollisionCount.set(variantCode, count + 1);
  
  const fullCode = `${productCode}${finalCode}`;
  usedCodes.add(fullCode);

  console.log(`[Variant Gen] ${combo.text} → baseCode: ${variantCode}, finalCode: ${finalCode}, count: ${count}, hasCollision: ${hasCollision}`);

  return {
    variantCode: finalCode,
    fullCode,
    baseCode: variantCode,
    hasCollision
  };
}

/**
 * Variant result
 */
export interface VariantResult {
  fullCode: string;
  variantCode: string;
  baseCode: string;
  hasCollision: boolean;
  productName: string;
  variantText: string;
  sizeText: string | null;
  color: string | null;
  sizeNumber: string | null;
}

/**
 * Main function: Generate all variants
 * @param config - Configuration object
 * @returns Array of variant objects
 */
export function generateAllVariants({
  productCode,
  productName,
  sizeTexts = [],
  colors = [],
  sizeNumbers = []
}: {
  productCode: string;
  productName: string;
  sizeTexts?: string[];
  colors?: string[];
  sizeNumbers?: string[];
}): VariantResult[] {
  // Validation
  if (!productCode || !productName) {
    throw new Error('productCode and productName are required');
  }

  if (sizeTexts.length === 0 && colors.length === 0 && sizeNumbers.length === 0) {
    throw new Error('At least one attribute (sizeTexts, colors, sizeNumbers) is required');
  }

  // Create cartesian product
  const combinations = createCartesianProduct({ sizeTexts, colors, sizeNumbers });

  // Generate codes
  const usedCodes = new Set<string>();
  const codeCollisionCount = new Map<string, number>();
  const results: VariantResult[] = [];

  for (const combo of combinations) {
    const codeInfo = generateVariantCode(combo, productCode, usedCodes, codeCollisionCount);
    const fullProductName = generateProductName(productName, combo.parts);

    results.push({
      // Code information
      fullCode: codeInfo.fullCode,
      variantCode: codeInfo.variantCode,
      baseCode: codeInfo.baseCode,
      hasCollision: codeInfo.hasCollision,
      
      // Name information
      productName: fullProductName,
      variantText: combo.text,
      
      // Component parts
      sizeText: combo.parts.sizeText || null,
      color: combo.parts.color || null,
      sizeNumber: combo.parts.sizeNumber || null
    });
  }

  return results;
}

/**
 * Variant statistics
 */
export interface VariantStatistics {
  total: number;
  unique: number;
  collisions: number;
  collisionRate: string;
}

/**
 * Utility function: Get statistics from results
 */
export function getVariantStatistics(results: VariantResult[]): VariantStatistics {
  const total = results.length;
  const collisions = results.filter(r => r.hasCollision).length;
  const unique = total - collisions;
  
  return {
    total,
    unique,
    collisions,
    collisionRate: total > 0 ? (collisions / total * 100).toFixed(1) : '0'
  };
}
