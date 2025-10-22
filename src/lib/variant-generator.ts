/**
 * VARIANT GENERATOR
 * Logic tạo mã SKU và tên biến thể cho hệ thống TPOS
 *
 * @author Claude
 * @date 2025
 */

// ============================================
// DATA: ATTRIBUTES & VALUES
// ============================================

export const TPOS_ATTRIBUTES_DATA = {
  ATTRIBUTES: [
    { Id: 1, Name: "Size Chữ", Code: "SZCh" },
    { Id: 3, Name: "Màu", Code: "Mau" },
    { Id: 4, Name: "Size Số", Code: "SZNu" },
  ],

  ATTRIBUTE_VALUES: {
    1: [
      { Id: 5, Name: "Free Size", Code: "FS" },
      { Id: 1, Name: "S", Code: "S" },
      { Id: 2, Name: "M", Code: "M" },
      { Id: 3, Name: "L", Code: "L" },
      { Id: 4, Name: "XL", Code: "XL" },
      { Id: 31, Name: "XXL", Code: "xxl" },
      { Id: 32, Name: "XXXL", Code: "xxxl" },
    ],
    3: [
      { Id: 6, Name: "Trắng", Code: "trang" },
      { Id: 7, Name: "Đen", Code: "den" },
      { Id: 8, Name: "Đỏ", Code: "do" },
      { Id: 9, Name: "Vàng", Code: "vang" },
      { Id: 10, Name: "Cam", Code: "cam" },
      { Id: 11, Name: "Xám", Code: "xam" },
      { Id: 12, Name: "Hồng", Code: "hong" },
      { Id: 14, Name: "Nude", Code: "nude" },
      { Id: 15, Name: "Nâu", Code: "nau" },
      { Id: 16, Name: "Rêu", Code: "reu" },
      { Id: 17, Name: "Xanh", Code: "xanh" },
      { Id: 25, Name: "Bạc", Code: "bac" },
      { Id: 26, Name: "Tím", Code: "tim" },
      { Id: 27, Name: "Xanh Min", Code: "xanhmin" },
      { Id: 28, Name: "Trắng Kem", Code: "trangkem" },
      { Id: 29, Name: "Xanh Lá", Code: "xanhla" },
      { Id: 38, Name: "Cổ Vịt", Code: "co vit" },
      { Id: 40, Name: "Xanh Đậu", Code: "xanh dau" },
      { Id: 42, Name: "Tím Môn", Code: "timmon" },
      { Id: 43, Name: "Muối Tiêu", Code: "muoitieu" },
      { Id: 45, Name: "Kem", Code: "kem" },
      { Id: 47, Name: "Hồng Đậm", Code: "hongdam" },
      { Id: 49, Name: "Ghi", Code: "ghi" },
      { Id: 50, Name: "Xanh Mạ", Code: "xanhma" },
      { Id: 51, Name: "Vàng Đồng", Code: "vangdong" },
      { Id: 52, Name: "Xanh Bơ", Code: "xanhbo" },
      { Id: 53, Name: "Xanh Đen", Code: "xanhden" },
      { Id: 54, Name: "Xanh CoBan", Code: "xanhcoban" },
      { Id: 55, Name: "Xám Đậm", Code: "xamdam" },
      { Id: 56, Name: "Xám Nhạt", Code: "xamnhat" },
      { Id: 57, Name: "Xanh Dương", Code: "xanhduong" },
      { Id: 58, Name: "Cam Sữa", Code: "camsua" },
      { Id: 59, Name: "Hồng Nhạt", Code: "hongnhat" },
      { Id: 60, Name: "Đậm", Code: "dam" },
      { Id: 61, Name: "Nhạt", Code: "nhat" },
      { Id: 62, Name: "Xám Khói", Code: "xamkhoi" },
      { Id: 63, Name: "Xám Chuột", Code: "xamchuot" },
      { Id: 64, Name: "Xám Đen", Code: "xamden" },
      { Id: 65, Name: "Xám Trắng", Code: "xamtrang" },
      { Id: 66, Name: "Xanh Đậm", Code: "xanhdam" },
      { Id: 67, Name: "Sọc Đen", Code: "socden" },
      { Id: 68, Name: "Sọc Trắng", Code: "soctrang" },
      { Id: 69, Name: "Sọc Xám", Code: "socxam" },
      { Id: 70, Name: "Jean Trắng", Code: "jeantrang" },
      { Id: 71, Name: "Jean Xanh", Code: "jeanxanh" },
      { Id: 72, Name: "Cam Đất", Code: "camdat" },
      { Id: 73, Name: "Nâu Đậm", Code: "naudam" },
      { Id: 74, Name: "Nâu Nhạt", Code: "naunhat" },
      { Id: 75, Name: "Đỏ Tươi", Code: "dotuoi" },
      { Id: 76, Name: "Đen Vàng", Code: "denvang" },
      { Id: 77, Name: "Cà Phê", Code: "caphe" },
      { Id: 78, Name: "Đen Bạc", Code: "denbac" },
      { Id: 79, Name: "Bò", Code: "bo" },
      { Id: 82, Name: "Sọc Xanh", Code: "socxanh" },
      { Id: 83, Name: "Xanh Rêu", Code: "xanhreu" },
      { Id: 84, Name: "Hồng Ruốc", Code: "hongruoc" },
      { Id: 85, Name: "Hồng Dâu", Code: "hongdau" },
      { Id: 86, Name: "Xanh Nhạt", Code: "xanhnhat" },
      { Id: 87, Name: "Xanh Ngọc", Code: "xanhngoc" },
      { Id: 88, Name: "Caro", Code: "caro" },
      { Id: 89, Name: "Sọc Hồng", Code: "sochong" },
      { Id: 90, Name: "Trong", Code: "trong" },
      { Id: 95, Name: "Trắng Hồng", Code: "tranghong" },
      { Id: 96, Name: "Trắng Sáng", Code: "trangsang" },
      { Id: 97, Name: "Đỏ Đô", Code: "dodo" },
      { Id: 98, Name: "Cam Đào", Code: "camdao" },
      { Id: 99, Name: "Cam Lạnh", Code: "camlanh" },
      { Id: 100, Name: "Hồng Đào", Code: "hongdao" },
      { Id: 101, Name: "Hồng Đất", Code: "hongdat" },
      { Id: 102, Name: "Tím Đậm", Code: "timdam" },
    ],
    4: [
      { Id: 22, Name: "1", Code: "1" },
      { Id: 23, Name: "2", Code: "2" },
      { Id: 24, Name: "3", Code: "3" },
      { Id: 48, Name: "4", Code: "4" },
      { Id: 80, Name: "27", Code: "27" },
      { Id: 81, Name: "28", Code: "28" },
      { Id: 18, Name: "29", Code: "29" },
      { Id: 19, Name: "30", Code: "30" },
      { Id: 20, Name: "31", Code: "31" },
      { Id: 21, Name: "32", Code: "32" },
      { Id: 46, Name: "34", Code: "34" },
      { Id: 33, Name: "35", Code: "35" },
      { Id: 34, Name: "36", Code: "36" },
      { Id: 35, Name: "37", Code: "37" },
      { Id: 36, Name: "38", Code: "38" },
      { Id: 37, Name: "39", Code: "39" },
      { Id: 44, Name: "40", Code: "40" },
      { Id: 91, Name: "41", Code: "41" },
      { Id: 92, Name: "42", Code: "42" },
      { Id: 93, Name: "43", Code: "43" },
      { Id: 94, Name: "44", Code: "44" },
    ],
  }
};

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

  // Detect các loại attribute
  const hasSizeText = attrs.some(attr => 
    attr.AttributeId === 1 || attr.AttributeName === "Size Chữ"
  );

  const hasColor = attrs.some(attr => 
    attr.AttributeId === 3 || attr.AttributeName === "Màu"
  );

  const hasSizeNumber = attrs.some(attr => 
    attr.AttributeId === 4 || attr.AttributeName === "Size Số"
  );

  // Nếu CHỈ CÓ size số (không có size chữ và màu), thêm "A"
  const isSizeNumberOnly = hasSizeNumber && !hasSizeText && !hasColor;
  
  if (isSizeNumberOnly) {
    code += "A";
  }

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
