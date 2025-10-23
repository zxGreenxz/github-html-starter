/**
 * VARIANT GENERATOR
 * Logic tạo mã SKU và tên biến thể cho hệ thống TPOS
 *
 * @author Claude
 * @date 2025
 */

// ============================================
// DATA: IMPORT FROM SINGLE SOURCE
// ============================================

import { TPOS_ATTRIBUTES_DATA } from "./tpos-attributes";

// Re-export for backward compatibility
export { TPOS_ATTRIBUTES_DATA };

// Type definitions
export interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  AttributeId?: number;
  AttributeName?: string;
}

export interface TPOSAttributeLine {
  Attribute: {
    Id: number;
    Name: string;
  };
  Values: TPOSAttributeValue[];
}

export interface ProductData {
  Id: number;
  Name: string;
  DefaultCode: string;
  ListPrice: number;
}

export interface GeneratedVariant {
  Id: number;
  Name: string;
  NameGet: string;
  DefaultCode: string;
  AttributeValues: TPOSAttributeValue[];
  Active: boolean;
  ProductTmplId: number;
  PriceVariant: number;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Tạo mã SKU duy nhất cho variant
 *
 * @param baseCode - Mã gốc của sản phẩm (DefaultCode)
 * @param attrs - Mảng các attribute values
 * @param existingCodes - Set chứa các mã đã tồn tại
 * @returns Mã SKU duy nhất
 *
 * @example
 * generateSKU("NTEST", [{Code: "S"}, {Code: "den"}, {Code: "28"}], new Set())
 * // Returns: "NTESTSD28"
 */
export function generateSKU(
  baseCode: string,
  attrs: TPOSAttributeValue[],
  existingCodes: Set<string>
): string {
  let code = baseCode;

  // Duyệt theo thứ tự tự nhiên của attrs
  for (const attr of attrs) {
    const attrCode = attr.Code || attr.Name;

    // Nếu là số thì giữ nguyên, nếu là chữ thì lấy ký tự đầu viết hoa
    if (/^\d+$/.test(attrCode)) {
      code += attrCode;
    } else {
      code += attrCode.charAt(0).toUpperCase();
    }
  }

  // Xử lý trùng lặp: thêm số 1, 11, 111...
  let finalCode = code;
  let suffix = "";
  let counter = 0;

  while (existingCodes.has(finalCode)) {
    counter++;
    suffix = "1".repeat(counter);
    finalCode = code + suffix;
  }

  existingCodes.add(finalCode);
  return finalCode;
}

/**
 * Tạo tên variant theo format chuẩn
 *
 * @param productName - Tên sản phẩm
 * @param attrs - Mảng các attribute values
 * @returns Tên variant
 *
 * @example
 * generateVariantName("NTEST", [{Name: "S"}, {Name: "Đen"}, {Name: "28"}])
 * // Returns: "NTEST (S, Đen, 28)"
 */
export function generateVariantName(
  productName: string,
  attrs: TPOSAttributeValue[]
): string {
  const attrNames = attrs.map((a) => a.Name).join(", ");
  return `${productName} (${attrNames})`;
}

/**
 * Tạo tất cả các tổ hợp variants từ attribute lines
 *
 * @param productData - Dữ liệu sản phẩm {Id, Name, DefaultCode, ListPrice}
 * @param attributeLines - Mảng các attribute lines
 * @returns Mảng các variant objects
 */
export function generateVariants(
  productData: ProductData,
  attributeLines: TPOSAttributeLine[]
): GeneratedVariant[] {
  if (!attributeLines || attributeLines.length === 0) {
    return [];
  }

  const combinations: TPOSAttributeValue[][] = [];

  // Tạo tất cả các tổ hợp cartesian
  function generateCombinations(index: number, current: TPOSAttributeValue[]) {
    if (index === attributeLines.length) {
      combinations.push([...current]);
      return;
    }

    const line = attributeLines[index];
    for (const value of line.Values) {
      generateCombinations(index + 1, [
        ...current,
        {
          AttributeId: line.Attribute.Id,
          AttributeName: line.Attribute.Name,
          ...value,
        },
      ]);
    }
  }

  generateCombinations(0, []);

  const existingCodes = new Set<string>();
  const baseCode = productData.DefaultCode || "PRODUCT";
  const productName = productData.Name || "Product";

  // Tạo variants từ các tổ hợp
  return combinations.map((attrs) => {
    const variantName = generateVariantName(productName, attrs);
    const variantCode = generateSKU(baseCode, attrs, existingCodes);

    return {
      Id: 0,
      Name: variantName,
      NameGet: variantName,
      DefaultCode: variantCode,
      AttributeValues: attrs,
      Active: true,
      ProductTmplId: productData.Id || 0,
      PriceVariant: productData.ListPrice || 0,
    };
  });
}

/**
 * So sánh variants dựa trên AttributeValues
 *
 * @param expectedVariants - Variants dự kiến tạo
 * @param actualVariants - Variants thực tế từ DB
 * @returns {matches, missing, extra}
 */
export function compareVariants(
  expectedVariants: GeneratedVariant[],
  actualVariants: GeneratedVariant[]
): {
  matches: Array<{ code: string; name: string }>;
  missing: Array<{ code: string; name: string }>;
  extra: Array<{ code: string; name: string }>;
} {
  const matches: Array<{ code: string; name: string }> = [];
  const missing: Array<{ code: string; name: string }> = [];
  const extra: Array<{ code: string; name: string }> = [];

  // Tạo signature dựa trên AttributeValues
  function getVariantSignature(variant: GeneratedVariant): string {
    if (!variant.AttributeValues || variant.AttributeValues.length === 0) {
      return "";
    }
    const attrValueIds = variant.AttributeValues.map((av) => av.Id)
      .sort((a, b) => a - b)
      .join(",");
    return attrValueIds;
  }

  // Tạo map từ signature -> variant
  const actualMap = new Map<string, GeneratedVariant>();
  actualVariants.forEach((v) => {
    const sig = getVariantSignature(v);
    if (sig) {
      actualMap.set(sig, v);
    }
  });

  // So sánh expected với actual
  for (const exp of expectedVariants) {
    const sig = getVariantSignature(exp);
    const variantName = exp.Name || exp.NameGet;
    const variantCode = exp.DefaultCode;

    if (actualMap.has(sig)) {
      matches.push({ code: variantCode, name: variantName });
      actualMap.delete(sig);
    } else {
      missing.push({ code: variantCode, name: variantName });
    }
  }

  // Những variants còn lại là thừa
  for (const [sig, v] of actualMap) {
    extra.push({ code: v.DefaultCode, name: v.Name });
  }

  return { matches, missing, extra };
}
