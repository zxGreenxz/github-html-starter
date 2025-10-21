import { getTPOSHeaders, getActiveTPOSToken, cleanBase64 } from "./tpos-config";
import { 
  TPOS_ATTRIBUTES,
  TPOS_ATTRIBUTE_IDS,
  TPOS_COLOR_MAP,
  TPOS_SIZE_TEXT_MAP,
  TPOS_SIZE_NUMBER_MAP,
  getVariantType
} from "./tpos-variant-attributes-compat";
import type { TPOSProductItem } from "./tpos-api";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface InsertV2AttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
}

export interface InsertV2AttributeLine {
  AttributeId: number;
  AttributeName: string;
  Values: InsertV2AttributeValue[];
}

export interface InsertV2ProductVariant {
  Name: string;
  PriceVariant: number;
  DefaultCode: string;
  Barcode: string | null;
  AttributeValues: Array<{
    Id: number;
    Name: string;
    Code: string;
    Sequence: number | null;
    AttributeId: number;
    AttributeName: string;
  }>;
}

export interface InsertV2Payload {
  Id: number;
  Name: string;
  Type: string;
  ListPrice: number;
  PurchasePrice: number;
  DefaultCode: string;
  Image: string | null;
  ImageUrl: null;
  Thumbnails: [];
  AttributeLines: InsertV2AttributeLine[];
  ProductVariants: InsertV2ProductVariant[];
  Active: boolean;
  SaleOK: boolean;
  PurchaseOK: boolean;
  UOMId: number;
  UOMPOId: number;
  CategId: number;
  CompanyId: number;
  Tracking: string;
  InvoicePolicy: string;
  PurchaseMethod: string;
  AvailableInPOS: boolean;
  DiscountSale: number;
  DiscountPurchase: number;
  StandardPrice: number;
  Weight: number;
  SaleDelay: number;
  UOM: any;
  UOMPO: any;
  Categ: any;
  Items: [];
  UOMLines: [];
  ComboProducts: [];
  ProductSupplierInfos: [];
}

export interface GroupedProduct {
  baseCode: string;
  baseName: string;
  variants: TPOSProductItem[];
  listPrice: number;
  purchasePrice: number;
  imageBase64: string | null;
}

// =====================================================
// GROUPING FUNCTIONS
// =====================================================

/**
 * Group variants by base product code
 * N497T, N497D, N497C -> N497: [T, D, C]
 * N494 (no variant) -> N494: []
 */
export function groupVariantsByBase(items: TPOSProductItem[]): GroupedProduct[] {
  const grouped = new Map<string, TPOSProductItem[]>();
  
  items.forEach(item => {
    // If no variant, use product_code as base
    const baseCode = item.variant ? extractBaseCode(item.product_code || '') : (item.product_code || '');
    
    if (!grouped.has(baseCode)) {
      grouped.set(baseCode, []);
    }
    grouped.get(baseCode)!.push(item);
  });
  
  return Array.from(grouped.entries()).map(([baseCode, variants]) => {
    const first = variants[0];
    const baseName = extractBaseName(first.product_name);
    
    return {
      baseCode,
      baseName,
      variants,
      listPrice: first.selling_price,
      purchasePrice: first.unit_price,
      imageBase64: null, // Will be loaded later if needed
    };
  });
}

/**
 * Extract base code from variant code
 * N497T -> N497, N494 -> N494
 */
function extractBaseCode(productCode: string): string {
  // Remove color/size suffix (last 1-2 chars that are letters)
  return productCode.replace(/[A-Z]{1,2}\d*$/, '');
}

/**
 * Extract base name without variant suffix
 * "DDDĐDD (TRẮNG)" -> "DDDĐDD"
 */
function extractBaseName(productName: string): string {
  return productName.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

// =====================================================
// ATTRIBUTE LINES BUILDER
// =====================================================

/**
 * Build AttributeLines from variants
 * Parse variant text and create TPOS attribute structure
 */
export function buildAttributeLines(variants: TPOSProductItem[]): InsertV2AttributeLine[] {
  const colorSet = new Set<string>();
  const sizeTextSet = new Set<string>();
  const sizeNumberSet = new Set<string>();
  
  // Collect all unique variants
  variants.forEach(item => {
    if (!item.variant) return;
    
    const variantType = getVariantType(item.variant);
    
    switch (variantType) {
      case 'color':
        colorSet.add(item.variant);
        break;
      case 'text-size':
        sizeTextSet.add(item.variant);
        break;
      case 'number-size':
        sizeNumberSet.add(item.variant);
        break;
    }
  });
  
  const attributeLines: InsertV2AttributeLine[] = [];
  
  // Build Color attribute line
  if (colorSet.size > 0) {
    const colorValues: InsertV2AttributeValue[] = [];
    colorSet.forEach(color => {
      const tposColor = TPOS_COLOR_MAP[color];
      if (tposColor) {
        const fullAttr = TPOS_ATTRIBUTES.color.find(c => c.Id === tposColor.Id);
        if (fullAttr) {
          colorValues.push({
            ...fullAttr,
            AttributeId: TPOS_ATTRIBUTE_IDS.COLOR,
            AttributeName: "Màu"
          });
        }
      }
    });
    
    if (colorValues.length > 0) {
      attributeLines.push({
        AttributeId: TPOS_ATTRIBUTE_IDS.COLOR,
        AttributeName: "Màu",
        Values: colorValues
      });
    }
  }
  
  // Build Size Text attribute line
  if (sizeTextSet.size > 0) {
    const sizeTextValues: InsertV2AttributeValue[] = [];
    sizeTextSet.forEach(size => {
      const tposSize = TPOS_SIZE_TEXT_MAP[size];
      if (tposSize) {
        const fullAttr = TPOS_ATTRIBUTES.sizeText.find(s => s.Id === tposSize.Id);
        if (fullAttr) {
          sizeTextValues.push({
            ...fullAttr,
            AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_TEXT,
            AttributeName: "Size Chữ"
          });
        }
      }
    });
    
    if (sizeTextValues.length > 0) {
      attributeLines.push({
        AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_TEXT,
        AttributeName: "Size Chữ",
        Values: sizeTextValues
      });
    }
  }
  
  // Build Size Number attribute line
  if (sizeNumberSet.size > 0) {
    const sizeNumberValues: InsertV2AttributeValue[] = [];
    sizeNumberSet.forEach(size => {
      const tposSize = TPOS_SIZE_NUMBER_MAP[size];
      if (tposSize) {
        const fullAttr = TPOS_ATTRIBUTES.sizeNumber.find(s => s.Id === tposSize.Id);
        if (fullAttr) {
          sizeNumberValues.push({
            ...fullAttr,
            AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER,
            AttributeName: "Size Số"
          });
        }
      }
    });
    
    if (sizeNumberValues.length > 0) {
      attributeLines.push({
        AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER,
        AttributeName: "Size Số",
        Values: sizeNumberValues
      });
    }
  }
  
  return attributeLines;
}

// =====================================================
// PRODUCT VARIANTS BUILDER
// =====================================================

/**
 * Build ProductVariants array for InsertV2
 */
export function buildProductVariants(
  baseName: string,
  baseCode: string,
  variants: TPOSProductItem[],
  listPrice: number
): InsertV2ProductVariant[] {
  return variants.map(item => {
    const attributeValues: any[] = [];
    
    if (item.variant) {
      const variantType = getVariantType(item.variant);
      
      switch (variantType) {
        case 'color': {
          const tposColor = TPOS_COLOR_MAP[item.variant];
          if (tposColor) {
            const fullAttr = TPOS_ATTRIBUTES.color.find(c => c.Id === tposColor.Id);
            if (fullAttr) {
              attributeValues.push(fullAttr);
            }
          }
          break;
        }
        case 'text-size': {
          const tposSize = TPOS_SIZE_TEXT_MAP[item.variant];
          if (tposSize) {
            const fullAttr = TPOS_ATTRIBUTES.sizeText.find(s => s.Id === tposSize.Id);
            if (fullAttr) {
              attributeValues.push(fullAttr);
            }
          }
          break;
        }
        case 'number-size': {
          const tposSize = TPOS_SIZE_NUMBER_MAP[item.variant];
          if (tposSize) {
            const fullAttr = TPOS_ATTRIBUTES.sizeNumber.find(s => s.Id === tposSize.Id);
            if (fullAttr) {
              attributeValues.push(fullAttr);
            }
          }
          break;
        }
      }
    }
    
    return {
      Name: item.product_name,
      PriceVariant: listPrice,
      DefaultCode: item.product_code || baseCode,
      Barcode: null,
      AttributeValues: attributeValues
    };
  });
}

// =====================================================
// MAIN PAYLOAD BUILDER
// =====================================================

/**
 * Build complete InsertV2 payload
 */
export function buildInsertV2Payload(group: GroupedProduct): InsertV2Payload {
  const attributeLines = buildAttributeLines(group.variants);
  const productVariants = buildProductVariants(
    group.baseName,
    group.baseCode,
    group.variants,
    group.listPrice
  );
  
  return {
    Id: 0,
    Name: group.baseName,
    Type: "product",
    ListPrice: group.listPrice,
    PurchasePrice: group.purchasePrice,
    DefaultCode: group.baseCode,
    Image: group.imageBase64,
    ImageUrl: null,
    Thumbnails: [],
    AttributeLines: attributeLines,
    ProductVariants: productVariants,
    Active: true,
    SaleOK: true,
    PurchaseOK: true,
    UOMId: 1,
    UOMPOId: 1,
    CategId: 2,
    CompanyId: 1,
    Tracking: "none",
    InvoicePolicy: "order",
    PurchaseMethod: "receive",
    AvailableInPOS: true,
    DiscountSale: 0,
    DiscountPurchase: 0,
    StandardPrice: 0,
    Weight: 0,
    SaleDelay: 0,
    UOM: {
      Id: 1,
      Name: "Cái",
      Rounding: 0.001,
      Active: true,
      Factor: 1,
      FactorInv: 1,
      UOMType: "reference",
      CategoryId: 1,
      CategoryName: "Đơn vị"
    },
    UOMPO: {
      Id: 1,
      Name: "Cái",
      Rounding: 0.001,
      Active: true,
      Factor: 1,
      FactorInv: 1,
      UOMType: "reference",
      CategoryId: 1,
      CategoryName: "Đơn vị"
    },
    Categ: {
      Id: 2,
      Name: "Có thể bán",
      CompleteName: "Có thể bán",
      Type: "normal",
      PropertyCostMethod: "average",
      NameNoSign: "Co the ban",
      IsPos: true
    },
    Items: [],
    UOMLines: [],
    ComboProducts: [],
    ProductSupplierInfos: []
  };
}

// =====================================================
// API CALL
// =====================================================

/**
 * Upload product to TPOS using InsertV2 API
 */
export async function uploadToTPOSInsertV2(payload: InsertV2Payload): Promise<any> {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
  }
  
  const createUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
  
  console.log('📤 Uploading to TPOS InsertV2:', {
    code: payload.DefaultCode,
    name: payload.Name,
    variants: payload.ProductVariants.length,
    attributeLines: payload.AttributeLines.length
  });
  
  const response = await fetch(createUrl, {
    method: 'POST',
    headers: getTPOSHeaders(token),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ TPOS API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      payload: JSON.stringify(payload, null, 2)
    });
    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    console.log('✅ Upload successful (204 No Content)');
    return { success: true, code: payload.DefaultCode };
  }
  
  const result = await response.json();
  console.log('✅ Upload successful:', result);
  
  return result;
}

// =====================================================
// IMAGE LOADING
// =====================================================

/**
 * Load image from URL and convert to base64
 */
export async function loadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load image:', error);
    return null;
  }
}
