// Variant attributes for product selection
// Complete TPOS attribute data structure

// TPOS Attribute IDs
export const TPOS_ATTRIBUTE_IDS = {
  SIZE_TEXT: 1,
  SIZE_NUMBER: 4,
  COLOR: 3
} as const;

// Full attribute data from TPOS
export interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
}

export const TPOS_ATTRIBUTES = {
  sizeText: [
    { Id: 5, Name: "Free Size", Code: "FS", Sequence: 0, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 1, Name: "S", Code: "S", Sequence: 1, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 2, Name: "M", Code: "M", Sequence: 2, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 3, Name: "L", Code: "L", Sequence: 3, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 4, Name: "XL", Code: "XL", Sequence: 4, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 31, Name: "XXL", Code: "xxl", Sequence: null, AttributeId: 1, AttributeName: "Size Chữ" },
    { Id: 32, Name: "XXXL", Code: "xxxl", Sequence: null, AttributeId: 1, AttributeName: "Size Chữ" }
  ],
  sizeNumber: [
    { Id: 80, Name: "27", Code: "27", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 81, Name: "28", Code: "28", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 18, Name: "29", Code: "29", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 19, Name: "30", Code: "30", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 20, Name: "31", Code: "31", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 21, Name: "32", Code: "32", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 46, Name: "34", Code: "34", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 33, Name: "35", Code: "35", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 34, Name: "36", Code: "36", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 35, Name: "37", Code: "37", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 36, Name: "38", Code: "38", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 37, Name: "39", Code: "39", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 44, Name: "40", Code: "40", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 91, Name: "41", Code: "41", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 92, Name: "42", Code: "42", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 93, Name: "43", Code: "43", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 94, Name: "44", Code: "44", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 22, Name: "1", Code: "1", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 23, Name: "2", Code: "2", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 24, Name: "3", Code: "3", Sequence: null, AttributeId: 4, AttributeName: "Size Số" },
    { Id: 48, Name: "4", Code: "4", Sequence: null, AttributeId: 4, AttributeName: "Size Số" }
  ],
  color: [
    { Id: 6, Name: "Trắng", Code: "trang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 7, Name: "Đen", Code: "den", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 8, Name: "Đỏ", Code: "do", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 9, Name: "Vàng", Code: "vang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 10, Name: "Cam", Code: "cam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 11, Name: "Xám", Code: "xam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 12, Name: "Hồng", Code: "hong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 14, Name: "Nude", Code: "nude", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 15, Name: "Nâu", Code: "nau", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 16, Name: "Rêu", Code: "reu", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 17, Name: "Xanh", Code: "xanh", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 25, Name: "Bạc", Code: "bac", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 26, Name: "Tím", Code: "tim", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 27, Name: "Xanh Min", Code: "xanhmin", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 28, Name: "Trắng Kem", Code: "trangkem", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 29, Name: "Xanh Lá", Code: "xanhla", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 38, Name: "Cổ Vịt", Code: "co vit", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 40, Name: "Xanh Đậu", Code: "xanh dau", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 42, Name: "Tím Môn", Code: "timmon", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 43, Name: "Muối Tiêu", Code: "muoitieu", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 45, Name: "Kem", Code: "kem", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 47, Name: "Hồng Đậm", Code: "hongdam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 49, Name: "Ghi", Code: "ghi", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 50, Name: "Xanh Mạ", Code: "xanhma", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 51, Name: "Vàng Đồng", Code: "vangdong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 52, Name: "Xanh Bơ", Code: "xanhbo", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 53, Name: "Xanh Đen", Code: "xanhden", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 54, Name: "Xanh CoBan", Code: "xanhcoban", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 55, Name: "Xám Đậm", Code: "xamdam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 56, Name: "Xám Nhạt", Code: "xamnhat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 57, Name: "Xanh Dương", Code: "xanhduong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 58, Name: "Cam Sữa", Code: "camsua", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 59, Name: "Hồng Nhạt", Code: "hongnhat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 60, Name: "Đậm", Code: "dam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 61, Name: "Nhạt", Code: "nhat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 62, Name: "Xám Khói", Code: "xamkhoi", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 63, Name: "Xám Chuột", Code: "xamchuot", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 64, Name: "Xám Đen", Code: "xamden", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 65, Name: "Xám Trắng", Code: "xamtrang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 66, Name: "Xanh Đậm", Code: "xanhdam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 67, Name: "Sọc Đen", Code: "socden", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 68, Name: "Sọc Trắng", Code: "soctrang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 69, Name: "Sọc Xám", Code: "socxam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 70, Name: "Jean Trắng", Code: "jeantrang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 71, Name: "Jean Xanh", Code: "jeanxanh", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 72, Name: "Cam Đất", Code: "camdat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 73, Name: "Nâu Đậm", Code: "naudam", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 74, Name: "Nâu Nhạt", Code: "naunhat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 75, Name: "Đỏ Tươi", Code: "dotuoi", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 76, Name: "Đen Vàng", Code: "denvang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 77, Name: "Cà Phê", Code: "caphe", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 78, Name: "Đen Bạc", Code: "denbac", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 79, Name: "Bò", Code: "bo", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 82, Name: "Sọc Xanh", Code: "socxanh", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 83, Name: "Xanh Rêu", Code: "xanhreu", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 84, Name: "Hồng Ruốc", Code: "hongruoc", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 85, Name: "Hồng Dâu", Code: "hongdau", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 86, Name: "Xanh Nhạt", Code: "xanhnhat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 87, Name: "Xanh Ngọc", Code: "xanhngoc", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 88, Name: "Caro", Code: "caro", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 89, Name: "Sọc Hồng", Code: "sochong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 90, Name: "Trong", Code: "trong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 95, Name: "Trắng Hồng", Code: "tranghong", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 96, Name: "Trắng Sáng", Code: "trangsang", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 97, Name: "Đỏ Đô", Code: "dodo", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 98, Name: "Cam Đào", Code: "camdao", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 99, Name: "Cam Lạnh", Code: "camlanh", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 100, Name: "Hồng Đào", Code: "hongdao", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 101, Name: "Hồng Đất", Code: "hongdat", Sequence: null, AttributeId: 3, AttributeName: "Màu" },
    { Id: 102, Name: "Tím Đậm", Code: "timdam", Sequence: null, AttributeId: 3, AttributeName: "Màu" }
  ]
} as const;

// Backward compatibility: Create maps for existing code
export const TPOS_SIZE_TEXT_MAP: Record<string, { Id: number; Code: string; Sequence: number | null }> = 
  Object.fromEntries(
    TPOS_ATTRIBUTES.sizeText.map(attr => [attr.Name, { Id: attr.Id, Code: attr.Code, Sequence: attr.Sequence }])
  );

export const TPOS_SIZE_NUMBER_MAP: Record<string, { Id: number; Code: string }> = 
  Object.fromEntries(
    TPOS_ATTRIBUTES.sizeNumber.map(attr => [attr.Name, { Id: attr.Id, Code: attr.Code }])
  );

export const TPOS_COLOR_MAP: Record<string, { Id: number; Code: string }> = 
  Object.fromEntries(
    TPOS_ATTRIBUTES.color.map(attr => [attr.Name, { Id: attr.Id, Code: attr.Code }])
  );

export const COLORS: readonly string[] = TPOS_ATTRIBUTES.color.map(attr => attr.Name);
export const TEXT_SIZES: readonly string[] = TPOS_ATTRIBUTES.sizeText.map(attr => attr.Name);
export const NUMBER_SIZES: readonly string[] = TPOS_ATTRIBUTES.sizeNumber.map(attr => attr.Name);

export type VariantType = 'color' | 'text-size' | 'number-size' | 'unknown';

/**
 * Determine the type of variant (color, text size, number size, or unknown)
 */
export function getVariantType(variant: string): VariantType {
  if (COLORS.includes(variant)) {
    return 'color';
  }
  if (TEXT_SIZES.includes(variant)) {
    return 'text-size';
  }
  if (NUMBER_SIZES.includes(variant)) {
    return 'number-size';
  }
  return 'unknown';
}

/**
 * Generate color code with duplicate handling
 * Single word: first letter (D for Đỏ)
 * Multiple words: first letter of each word (DD for Đỏ Đỏ, DB for Đen Bạc)
 * Duplicates: add number suffix (D1, D2, etc.)
 */
export function generateColorCode(color: string, usedCodes: Set<string>): string {
  const words = color.trim().split(/\s+/);
  
  let code = '';
  if (words.length === 1) {
    // Single word: take first letter
    code = words[0].charAt(0);
  } else {
    // Multiple words: take first letter of each word
    code = words.map(word => word.charAt(0)).join('');
  }
  
  // Convert to uppercase without Vietnamese diacritics
  code = code.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'D')
    .replace(/Đ/g, 'D');
  
  // Handle duplicates by adding number suffix
  let finalCode = code;
  let counter = 1;
  while (usedCodes.has(finalCode)) {
    finalCode = `${code}${counter}`;
    counter++;
  }
  
  usedCodes.add(finalCode);
  return finalCode;
}

/**
 * Generate variant code based on variant type
 */
export function generateVariantCode(variant: string, usedCodes: Set<string>): string {
  const type = getVariantType(variant);
  
  switch (type) {
    case 'color':
      return generateColorCode(variant, usedCodes);
    
    case 'text-size':
      // Return size name as-is (e.g., "M" -> "M")
      return variant;
    
    case 'number-size':
      // Return "A" + size name (e.g., "40" -> "A40")
      return `A${variant}`;
    
    case 'unknown':
      // Fallback to old logic
      return variant.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'D')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, '');
  }
}

/**
 * Generate product name with variant
 */
export function generateProductNameWithVariant(productName: string, variant: string): string {
  const type = getVariantType(variant);
  
  if (type === 'color') {
    return `${productName} ${variant}`;
  } else {
    // For sizes (both text and number)
    return `${productName} size ${variant}`;
  }
}
