/**
 * Adapter to convert between old variant generator API and new variant generator
 * This maintains backward compatibility while using the new logic
 */

import { 
  generateVariants, 
  TPOSAttributeLine, 
  ProductData,
  TPOS_ATTRIBUTES_DATA 
} from "./variant-generator";
import { TPOS_ATTRIBUTES } from "./tpos-attributes";

/**
 * Convert comma-separated variant string to AttributeLines
 * e.g., "M, L, XL, Đen, Trắng, 28, 29" -> AttributeLines
 */
export function parseVariantStringToAttributeLines(variantString: string): TPOSAttributeLine[] {
  if (!variantString || !variantString.trim()) {
    return [];
  }

  // Split by comma and trim
  const parts = variantString.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  const sizeTextValues: any[] = [];
  const colorValues: any[] = [];
  const sizeNumberValues: any[] = [];

  // Match each part to attribute values
  for (const part of parts) {
    // Try sizeText
    const sizeText = TPOS_ATTRIBUTES.sizeText.find(
      s => s.Name.toLowerCase() === part.toLowerCase()
    );
    if (sizeText) {
      sizeTextValues.push(sizeText);
      continue;
    }

    // Try color
    const color = TPOS_ATTRIBUTES.color.find(
      c => c.Name.toLowerCase() === part.toLowerCase()
    );
    if (color) {
      colorValues.push(color);
      continue;
    }

    // Try sizeNumber
    const sizeNumber = TPOS_ATTRIBUTES.sizeNumber.find(
      s => s.Name === part
    );
    if (sizeNumber) {
      sizeNumberValues.push(sizeNumber);
      continue;
    }
  }

  const attributeLines: TPOSAttributeLine[] = [];

  // Add Size Text if present
  if (sizeTextValues.length > 0) {
    attributeLines.push({
      Attribute: { Id: 1, Name: "Size Chữ" },
      Values: sizeTextValues
    });
  }

  // Add Color if present
  if (colorValues.length > 0) {
    attributeLines.push({
      Attribute: { Id: 3, Name: "Màu" },
      Values: colorValues
    });
  }

  // Add Size Number if present
  if (sizeNumberValues.length > 0) {
    attributeLines.push({
      Attribute: { Id: 4, Name: "Size Số" },
      Values: sizeNumberValues
    });
  }

  return attributeLines;
}

/**
 * Generate variants from arrays of size/color/number
 * Maintains old API: generateAllVariants({ productCode, productName, sizeTexts, colors, sizeNumbers })
 */
export interface GenerateAllVariantsParams {
  productCode: string;
  productName: string;
  sizeTexts?: string[];
  colors?: string[];
  sizeNumbers?: string[];
}

export interface GeneratedVariantResult {
  fullCode: string;
  variantCode: string;
  productName: string;
  variantText: string;
  hasCollision: boolean;
}

export function generateAllVariants(params: GenerateAllVariantsParams): GeneratedVariantResult[] {
  const { productCode, productName, sizeTexts = [], colors = [], sizeNumbers = [] } = params;

  // Convert to AttributeLines
  const attributeLines: TPOSAttributeLine[] = [];

  if (sizeTexts.length > 0) {
    const values = sizeTexts
      .map(name => TPOS_ATTRIBUTES.sizeText.find(s => s.Name === name))
      .filter(Boolean) as any[];
    
    if (values.length > 0) {
      attributeLines.push({
        Attribute: { Id: 1, Name: "Size Chữ" },
        Values: values
      });
    }
  }

  if (colors.length > 0) {
    const values = colors
      .map(name => TPOS_ATTRIBUTES.color.find(c => c.Name === name))
      .filter(Boolean) as any[];
    
    if (values.length > 0) {
      attributeLines.push({
        Attribute: { Id: 3, Name: "Màu" },
        Values: values
      });
    }
  }

  if (sizeNumbers.length > 0) {
    const values = sizeNumbers
      .map(name => TPOS_ATTRIBUTES.sizeNumber.find(s => s.Name === name))
      .filter(Boolean) as any[];
    
    if (values.length > 0) {
      attributeLines.push({
        Attribute: { Id: 4, Name: "Size Số" },
        Values: values
      });
    }
  }

  // Generate variants using new logic
  const productData: ProductData = {
    Id: 0,
    Name: productName,
    DefaultCode: productCode,
    ListPrice: 0
  };

  const variants = generateVariants(productData, attributeLines);

  // Convert to old format
  return variants.map(v => {
    // Extract variant text from attribute values
    const variantText = v.AttributeValues?.map(av => av.Name).join(', ') || '';
    
    // Extract variant code (remove base code)
    const variantCode = v.DefaultCode.replace(productCode, '');
    
    // Check if has collision (if variant code ends with 1, 11, 111, etc.)
    const hasCollision = /1+$/.test(variantCode);

    return {
      fullCode: v.DefaultCode,
      variantCode: variantCode || v.DefaultCode,
      productName: v.Name,
      variantText,
      hasCollision
    };
  });
}
