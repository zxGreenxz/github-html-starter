/**
 * Parse variant string into name and code components
 * Format: "variant_name - product_code"
 * Example: "Size M - N152" → { name: "Size M", code: "N152" }
 */
export const parseVariant = (variant: string | null | undefined): { name: string; code: string } => {
  if (!variant || variant.trim() === '') {
    return { name: '', code: '' };
  }
  
  const trimmed = variant.trim();
  
  // Format: "variant_name - product_code"
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        code: parts.slice(1).join(' - ').trim() // Handle edge case: "2-in-1 - N152"
      };
    }
  }
  
  // Format: "- product_code" (no variant name)
  if (trimmed.startsWith('- ')) {
    return {
      name: '',
      code: trimmed.substring(2).trim()
    };
  }
  
  // Old format: just variant name (backward compatibility)
  return {
    name: trimmed,
    code: ''
  };
};

/**
 * Format variant string from name and code
 */
export const formatVariant = (name: string | null | undefined, code: string): string => {
  const trimmedName = name?.trim() || '';
  const trimmedCode = code.trim();
  
  if (!trimmedName && !trimmedCode) return '';
  if (!trimmedName) return `- ${trimmedCode}`;
  return `${trimmedName} - ${trimmedCode}`;
};

/**
 * Get only the variant name part (before " - ")
 * If no " - " exists (old data), return full string
 */
export const getVariantName = (variant: string | null | undefined): string => {
  return parseVariant(variant).name;
};

/**
 * Get only the variant code part (after " - ")
 */
export const getVariantCode = (variant: string | null | undefined): string => {
  return parseVariant(variant).code;
};

/**
 * Format variant từ AttributeValues của TPOS theo cấu trúc AttributeLines
 * 
 * Input: [
 *   { AttributeName: "Số lượng", Name: "1" },
 *   { AttributeName: "Số lượng", Name: "2" },
 *   { AttributeName: "Màu sắc", Name: "Nude" },
 *   { AttributeName: "Màu sắc", Name: "Nâu" },
 *   { AttributeName: "Màu sắc", Name: "Hồng" }
 * ]
 * 
 * Output: "(1 | 2) (Nude | Nâu | Hồng)"
 */
export function formatVariantFromAttributeValues(
  attributeValues: Array<{
    AttributeName: string;
    Name: string;
  }>
): string {
  if (!attributeValues || attributeValues.length === 0) return '';
  
  // Group by AttributeName
  const grouped = attributeValues.reduce((acc, attr) => {
    if (!acc[attr.AttributeName]) {
      acc[attr.AttributeName] = [];
    }
    acc[attr.AttributeName].push(attr.Name);
    return acc;
  }, {} as Record<string, string[]>);
  
  // Format: Tất cả đều dùng " | " làm separator
  const groups = Object.values(grouped).map(values => {
    return `(${values.join(' | ')})`;
  });
  
  return groups.join(' ');
}

/**
 * Parse AttributeLines từ TPOS API thành variant string
 * 
 * Input: product.AttributeLines (nested structure)
 * Output: "(Cam | Đỏ | Vàng) (Size M | Size L)"
 * 
 * Khác với formatVariantFromAttributeValues:
 * - AttributeValues: Mảng phẳng { AttributeName, Name }
 * - AttributeLines: Nested { Attribute, Values[] }
 */
export function formatVariantFromTPOSAttributeLines(
  attributeLines: Array<{
    Attribute: { Id: number };
    Values: Array<{
      Id: number;
      Name: string;
      AttributeName: string;
    }>;
    AttributeId: number;
  }> | undefined
): string {
  if (!attributeLines || attributeLines.length === 0) {
    return "";
  }

  // Group values by AttributeName
  const grouped: Record<string, string[]> = {};
  
  console.log('🔍 [formatVariantFromTPOSAttributeLines] Raw attributeLines:', JSON.stringify(attributeLines, null, 2));
  
  attributeLines.forEach((line, lineIndex) => {
    console.log(`📋 [Line ${lineIndex}] AttributeId: ${line.AttributeId}, Values count: ${line.Values.length}`);
    
    line.Values.forEach((value, valueIndex) => {
      const attrName = value.AttributeName;
      
      console.log(`  ↳ [Value ${valueIndex}] AttributeName: "${attrName}", Name: "${value.Name}"`);
      
      // ✅ CRITICAL: Skip nếu AttributeName bị null/undefined/empty
      if (!attrName || attrName.trim() === '') {
        console.warn(`  ⚠️ SKIPPED: Value "${value.Name}" has invalid AttributeName:`, attrName);
        return;
      }
      
      if (!grouped[attrName]) {
        grouped[attrName] = [];
      }
      // Tránh duplicate
      if (!grouped[attrName].includes(value.Name)) {
        grouped[attrName].push(value.Name);
      }
    });
  });

  console.log('📊 [formatVariantFromTPOSAttributeLines] Grouped:', grouped);

  // Format: "(Val1 | Val2) (ValA | ValB)"
  const parts = Object.values(grouped).map(values => 
    `(${values.join(' | ')})`
  );

  const result = parts.join(' ');
  console.log('✅ [formatVariantFromTPOSAttributeLines] Result:', result);

  return result;
}
