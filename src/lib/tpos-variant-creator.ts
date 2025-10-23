// TPOS Variant Creator - Auto create variants on TPOS after product upload
import { getActiveTPOSToken, getTPOSHeaders, generateRandomId } from "./tpos-config";
import { TPOS_ATTRIBUTE_IDS, TPOS_ATTRIBUTES, type TPOSAttributeValue as ImportedTPOSAttributeValue } from "./tpos-variant-attributes-compat";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
  PriceExtra: null;
  NameGet: string;
  DateCreated: null;
}

interface TPOSAttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: number;
    CreateVariant: boolean;
  };
  Values: TPOSAttributeValue[];
  AttributeId: number;
}

interface SelectedAttributes {
  sizeText?: ImportedTPOSAttributeValue[];
  sizeNumber?: ImportedTPOSAttributeValue[];
  color?: ImportedTPOSAttributeValue[];
}

// =====================================================
// STEP 1: GET PRODUCT FROM TPOS
// =====================================================

export async function getTPOSProduct(tposProductId: number, retries = 3, delayMs = 2000): Promise<any> {
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("No active TPOS token found");
  }

  const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${retries}: Getting product ${tposProductId} from TPOS...`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: getTPOSHeaders(bearerToken),
      });

      if (!response.ok) {
        throw new Error(`Failed to get TPOS product: ${response.statusText}`);
      }

      const product = await response.json();
      console.log(`✅ Successfully retrieved product ${tposProductId}`);
      return product;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt < retries) {
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Failed to get TPOS product after ${retries} attempts: ${lastError?.message}`);
}

// =====================================================
// STEP 2: PARSE VARIANT TO SELECTED ATTRIBUTES
// =====================================================

/**
 * Helper function: Match exact attribute (no splitting, no multi-word matching)
 * Used when comma delimiter is detected
 */
function matchExactAttribute(text: string, result: SelectedAttributes): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  // Try sizeText (case-insensitive)
  const sizeText = TPOS_ATTRIBUTES.sizeText.find(s => 
    s.Name.toLowerCase() === trimmed.toLowerCase()
  );
  if (sizeText) {
    if (!result.sizeText) result.sizeText = [];
    if (!result.sizeText.find(s => s.Id === sizeText.Id)) {
      result.sizeText.push(sizeText);
      console.log(`✓ Matched sizeText: "${trimmed}" → "${sizeText.Name}"`);
    }
    return true;
  }
  
  // Try sizeNumber (exact)
  const sizeNumber = TPOS_ATTRIBUTES.sizeNumber.find(s => s.Name === trimmed);
  if (sizeNumber) {
    if (!result.sizeNumber) result.sizeNumber = [];
    if (!result.sizeNumber.find(s => s.Id === sizeNumber.Id)) {
      result.sizeNumber.push(sizeNumber);
      console.log(`✓ Matched sizeNumber: "${trimmed}" → "${sizeNumber.Name}"`);
    }
    return true;
  }
  
  // Try color (case-insensitive)
  const color = TPOS_ATTRIBUTES.color.find(c => 
    c.Name.toLowerCase() === trimmed.toLowerCase()
  );
  if (color) {
    if (!result.color) result.color = [];
    if (!result.color.find(c => c.Id === color.Id)) {
      result.color.push(color);
      console.log(`✓ Matched color: "${trimmed}" → "${color.Name}"`);
    }
    return true;
  }
  
  console.warn(`⚠️ Không tìm thấy attribute: "${trimmed}"`);
  return false;
}

/**
 * Helper: Auto-detect attribute type based on values
 */
function detectAttributeType(values: string[]): 1 | 3 | 4 {
  if (values.every(v => /^\d+$/.test(v))) return 4; // Size Số
  if (values.every(v => v.length <= 4 && /^[A-Z]+$/i.test(v))) return 1; // Size Chữ
  return 3; // Màu
}

export function parseVariantToAttributes(variant: string): SelectedAttributes {
  const result: SelectedAttributes = {};
  
  if (!variant || !variant.trim()) {
    return result;
  }
  
  const trimmed = variant.trim();
  
  // ✅ STRATEGY A: NEW FORMAT with parentheses "(S | M) (31 | 30) (ĐỎ | ĐEN)"
  const groupPattern = /\(([^)]+)\)/g;
  const groups: string[] = [];
  let match;
  
  while ((match = groupPattern.exec(trimmed)) !== null) {
    groups.push(match[1]);
  }
  
  if (groups.length > 0) {
    console.log(`🔍 Parsing variant: "${variant}" (Strategy: PARENTHESES)`);
    
    for (const group of groups) {
      const values = group.split('|').map(v => v.trim()).filter(v => v.length > 0);
      if (values.length === 0) continue;
      
      const detectedType = detectAttributeType(values);
      
      if (detectedType === 4) {
        // Size Số
        if (!result.sizeNumber) result.sizeNumber = [];
        for (const val of values) {
          const sizeNumber = TPOS_ATTRIBUTES.sizeNumber.find(s => s.Name === val);
          if (sizeNumber && !result.sizeNumber.find(s => s.Id === sizeNumber.Id)) {
            result.sizeNumber.push(sizeNumber);
          }
        }
      } else if (detectedType === 1) {
        // Size Chữ
        if (!result.sizeText) result.sizeText = [];
        for (const val of values) {
          const sizeText = TPOS_ATTRIBUTES.sizeText.find(
            s => s.Name.toLowerCase() === val.toLowerCase()
          );
          if (sizeText && !result.sizeText.find(s => s.Id === sizeText.Id)) {
            result.sizeText.push(sizeText);
          }
        }
      } else {
        // Màu
        if (!result.color) result.color = [];
        for (const val of values) {
          const color = TPOS_ATTRIBUTES.color.find(
            c => c.Name.toLowerCase() === val.toLowerCase()
          );
          if (color && !result.color.find(c => c.Id === color.Id)) {
            result.color.push(color);
          }
        }
      }
    }
    
    console.log(`   Result:`, result);
    return result;
  }
  
  // ✅ STRATEGY B: Comma-delimited → exact match for each part
  const hasComma = trimmed.includes(',');
  
  if (hasComma) {
    console.log(`🔍 Parsing variant: "${variant}" (Strategy: COMMA)`);
    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    for (const part of parts) {
      matchExactAttribute(part, result);
    }
    
    console.log(`   Result:`, result);
    return result;
  }
  
  // ✅ STRATEGY C: No comma → use multi-word matching (original logic)
  console.log(`🔍 Parsing variant: "${variant}" (Strategy: SPACE/MULTI-WORD)`);
  
  // Step 1: Normalize input - trim, replace separators with space (exclude comma)
  const normalized = trimmed
    .replace(/[-/]/g, ' ')       // Replace -, / with space (NOT comma)
    .replace(/\s+/g, ' ');       // Multiple spaces → single space
  
  // Step 2: Try to match multi-word variants first (e.g., "Xám Đậm", "Jean Xanh")
  // Sort colors by length (longest first) to match multi-word variants first
  const sortedColors = [...TPOS_ATTRIBUTES.color].sort((a, b) => b.Name.length - a.Name.length);
  
  let remaining = normalized;
  const matched = new Set<string>();
  
  // Try exact match for multi-word colors (case-sensitive first)
  for (const color of sortedColors) {
    if (remaining.includes(color.Name)) {
      if (!result.color) result.color = [];
      if (!result.color.find(c => c.Id === color.Id)) {
        result.color.push(color);
        matched.add(color.Name);
      }
      remaining = remaining.replace(color.Name, '').replace(/\s+/g, ' ').trim();
    }
  }
  
  // Try case-insensitive match for remaining multi-word colors
  const remainingLower = remaining.toLowerCase();
  for (const color of sortedColors) {
    if (remainingLower.includes(color.Name.toLowerCase())) {
      if (!result.color) result.color = [];
      if (!result.color.find(c => c.Id === color.Id)) {
        result.color.push(color);
        matched.add(color.Name);
      }
      const regex = new RegExp(color.Name, 'gi');
      remaining = remaining.replace(regex, '').replace(/\s+/g, ' ').trim();
    }
  }
  
  // Step 3: Split remaining parts and match single-word variants
  const parts = remaining.split(/\s+/).filter(p => p.length > 0);
  const unmatched: string[] = [];
  
  for (const part of parts) {
    let found = false;
    
    // 1. Try exact match in sizeText
    const sizeText = TPOS_ATTRIBUTES.sizeText.find(s => s.Name === part);
    if (sizeText) {
      if (!result.sizeText) result.sizeText = [];
      if (!result.sizeText.find(s => s.Id === sizeText.Id)) {
        result.sizeText.push(sizeText);
        found = true;
      }
    }
    
    // 2. Try exact match in sizeNumber
    const sizeNumber = TPOS_ATTRIBUTES.sizeNumber.find(s => s.Name === part);
    if (sizeNumber) {
      if (!result.sizeNumber) result.sizeNumber = [];
      if (!result.sizeNumber.find(s => s.Id === sizeNumber.Id)) {
        result.sizeNumber.push(sizeNumber);
        found = true;
      }
    }
    
    // 3. Try exact match in color
    const color = TPOS_ATTRIBUTES.color.find(c => c.Name === part);
    if (color) {
      if (!result.color) result.color = [];
      if (!result.color.find(c => c.Id === color.Id)) {
        result.color.push(color);
        found = true;
      }
    }
    
    // 4. Try case-insensitive match for colors
    if (!found) {
      const colorCI = TPOS_ATTRIBUTES.color.find(c => 
        c.Name.toLowerCase() === part.toLowerCase()
      );
      if (colorCI) {
        if (!result.color) result.color = [];
        if (!result.color.find(c => c.Id === colorCI.Id)) {
          result.color.push(colorCI);
          found = true;
        }
      }
    }
    
    // 5. Try splitting compound sizes like "SM" → "S" + "M"
    if (!found && part.length === 2 && /^[SMLX]{2}$/i.test(part)) {
      const s1 = TPOS_ATTRIBUTES.sizeText.find(s => s.Name.toUpperCase() === part[0].toUpperCase());
      const s2 = TPOS_ATTRIBUTES.sizeText.find(s => s.Name.toUpperCase() === part[1].toUpperCase());
      if (s1 && s2) {
        if (!result.sizeText) result.sizeText = [];
        if (!result.sizeText.find(s => s.Id === s1.Id)) result.sizeText.push(s1);
        if (!result.sizeText.find(s => s.Id === s2.Id)) result.sizeText.push(s2);
        found = true;
      }
    }
    
    if (!found && part.length > 0) {
      unmatched.push(part);
    }
  }
  
  // Step 4: Warning for unmatched parts
  if (unmatched.length > 0) {
    console.warn(`⚠️ Không tìm thấy trong kho attribute: "${unmatched.join('", "')}"`);
    console.warn(`   Từ variant gốc: "${variant}"`);
  }
  
  console.log(`   Result:`, result);
  return result;
}

// =====================================================
// STEP 3: CREATE ATTRIBUTE LINES (MERGE WITH EXISTING)
// =====================================================

export function createAttributeLines(
  selectedAttributes: SelectedAttributes, 
  existingAttributeLines: TPOSAttributeLine[] = []
): TPOSAttributeLine[] {
  const attributeLines: TPOSAttributeLine[] = [];
  
  // DO NOT MERGE - Just create new attribute lines (overwrite mode)
  // This will replace all existing variants on TPOS
  
  // Thứ tự sắp xếp: Màu → Size Chữ → Size Số (giống với tạo biến thể tự động)
  
  // Màu (AttributeId = 3) - FIRST
  if (selectedAttributes.color && selectedAttributes.color.length > 0) {
    const newValues = selectedAttributes.color.map(attr => ({
      Id: attr.Id,
      Name: attr.Name,
      Code: attr.Code,
      Sequence: null,
      AttributeId: 3,
      AttributeName: "Màu",
      PriceExtra: null,
      NameGet: `Màu: ${attr.Name}`,
      DateCreated: null
    }));
    
    attributeLines.push({
      Attribute: {
        Id: 3,
        Name: "Màu",
        Code: "mau",
        Sequence: 1,
        CreateVariant: true
      },
      Values: newValues,
      AttributeId: 3
    });
  }
  
  // Size Chữ (AttributeId = 1) - SECOND
  if (selectedAttributes.sizeText && selectedAttributes.sizeText.length > 0) {
    const newValues = selectedAttributes.sizeText.map(attr => ({
      Id: attr.Id,
      Name: attr.Name,
      Code: attr.Code,
      Sequence: attr.Sequence,
      AttributeId: 1,
      AttributeName: "Size Chữ",
      PriceExtra: null,
      NameGet: `Size Chữ: ${attr.Name}`,
      DateCreated: null
    }));
    
    attributeLines.push({
      Attribute: {
        Id: 1,
        Name: "Size Chữ",
        Code: "SZCh",
        Sequence: 2,
        CreateVariant: true
      },
      Values: newValues,
      AttributeId: 1
    });
  }
  
  // Size Số (AttributeId = 4) - THIRD
  if (selectedAttributes.sizeNumber && selectedAttributes.sizeNumber.length > 0) {
    const newValues = selectedAttributes.sizeNumber.map(attr => ({
      Id: attr.Id,
      Name: attr.Name,
      Code: attr.Code,
      Sequence: null,
      AttributeId: 4,
      AttributeName: "Size Số",
      PriceExtra: null,
      NameGet: `Size Số: ${attr.Name}`,
      DateCreated: null
    }));
    
    attributeLines.push({
      Attribute: {
        Id: 4,
        Name: "Size Số",
        Code: "SZS",
        Sequence: 3,
        CreateVariant: true
      },
      Values: newValues,
      AttributeId: 4
    });
  }
  
  return attributeLines;
}

// =====================================================
// STEP 4: CARTESIAN PRODUCT FOR VARIANTS
// =====================================================

function cartesianProduct(...arrays: any[][]): any[][] {
  return arrays.reduce((acc, array) => {
    return acc.flatMap((x: any) => array.map((y: any) => [x, y].flat()));
  }, [[]] as any[][]);
}

export function generateVariants(originalProduct: any, attributeLines: TPOSAttributeLine[]): any[] {
  // Get all values from attributeLines
  const allValues = attributeLines.map(line => line.Values);
  
  // Create all combinations
  const combinations = cartesianProduct(...allValues);
  
  // Create NEW variants for each combination (OVERWRITE mode - do not keep old variants)
  const newVariants = combinations.map(combo => {
    const attrArray = Array.isArray(combo) ? combo : [combo];
    const names = attrArray.map(a => a.Name).join(', ');
    
    return {
      Id: 0, // 0 = new variant
      EAN13: null,
      DefaultCode: null,
      NameTemplate: originalProduct.Name,
      NameNoSign: null,
      ProductTmplId: originalProduct.Id,
      UOMId: 0,
      UOMName: null,
      UOMPOId: 0,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      NameGet: `${originalProduct.Name} (${names})`,
      POSCategId: null,
      Price: null,
      Barcode: null,
      Image: null,
      ImageUrl: null,
      Thumbnails: [],
      PriceVariant: originalProduct.ListPrice,
      SaleOK: true,
      PurchaseOK: true,
      DisplayAttributeValues: null,
      LstPrice: 0,
      Active: true,
      ListPrice: 0,
      PurchasePrice: null,
      DiscountSale: null,
      DiscountPurchase: null,
      StandardPrice: 0,
      Weight: 0,
      Volume: null,
      OldPrice: null,
      IsDiscount: false,
      ProductTmplEnableAll: false,
      Version: 0,
      Description: null,
      LastUpdated: null,
      Type: "product",
      CategId: 0,
      CostMethod: null,
      InvoicePolicy: "order",
      Variant_TeamId: 0,
      Name: `${originalProduct.Name} (${names})`,
      PropertyCostMethod: null,
      PropertyValuation: null,
      PurchaseMethod: "receive",
      SaleDelay: 0,
      Tracking: null,
      Valuation: null,
      AvailableInPOS: true,
      CompanyId: null,
      IsCombo: null,
      NameTemplateNoSign: originalProduct.NameNoSign,
      TaxesIds: [],
      StockValue: null,
      SaleValue: null,
      PosSalesCount: null,
      Factor: null,
      CategName: null,
      AmountTotal: null,
      NameCombos: [],
      RewardName: null,
      Product_UOMId: null,
      Tags: null,
      DateCreated: null,
      InitInventory: 0,
      OrderTag: null,
      StringExtraProperties: null,
      CreatedById: null,
      Error: null,
      AttributeValues: attrArray.map(a => ({
        Id: a.Id,
        Name: a.Name,
        Code: null,
        Sequence: null,
        AttributeId: a.AttributeId,
        AttributeName: a.AttributeName,
        PriceExtra: null,
        NameGet: `${a.AttributeName}: ${a.Name}`,
        DateCreated: null
      }))
    };
  });
  
  // OVERWRITE mode: Do NOT include existing variants
  // All old variants will be replaced by new ones
  console.log(`🔄 OVERWRITE mode: Creating ${newVariants.length} new variants (old variants will be replaced)`);
  
  return newVariants;
}

// =====================================================
// STEP 5: CREATE PAYLOAD
// =====================================================

export function createPayload(originalProduct: any, attributeLines: TPOSAttributeLine[], variants: any[]): any {
  // Clone originalProduct
  const payload = JSON.parse(JSON.stringify(originalProduct));
  
  // 1. Remove @odata.context
  delete payload['@odata.context'];
  
  // 2. Set Version = 0
  payload.Version = 0;
  
  // 3. Add AttributeLines
  payload.AttributeLines = attributeLines;
  
  // 4. Replace ProductVariants
  payload.ProductVariants = variants;
  
  // 5. Add required arrays
  payload.Items = [];
  
  payload.UOMLines = [{
    Id: payload.Id,
    ProductTmplId: payload.Id,
    ProductTmplListPrice: null,
    UOMId: payload.UOM?.Id || 1,
    TemplateUOMFactor: 0,
    ListPrice: payload.ListPrice,
    Barcode: "",
    Price: null,
    ProductId: 0,
    UOMName: null,
    NameGet: null,
    Factor: 0,
    UOM: payload.UOM
  }];
  
  payload.ComboProducts = [];
  payload.ProductSupplierInfos = [];
  
  return payload;
}

// =====================================================
// STEP 6: POST PAYLOAD
// =====================================================

export async function postTPOSVariantPayload(payload: any): Promise<any> {
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("No active TPOS token found");
  }

  const url = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: getTPOSHeaders(bearerToken),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post TPOS variant: ${response.statusText} - ${errorText}`);
  }
  
  return await response.json();
}

// =====================================================
// MAIN FLOW
// =====================================================

export async function createTPOSVariants(
  tposProductId: number, 
  variant: string,
  onProgress?: (message: string) => void
): Promise<any> {
  try {
    onProgress?.(`Đang lấy thông tin sản phẩm ${tposProductId}...`);
    const originalProduct = await getTPOSProduct(tposProductId);
    
    onProgress?.(`Đang phân tích variant "${variant}"...`);
    const selectedAttributes = parseVariantToAttributes(variant);
    
    if (!selectedAttributes.sizeText && !selectedAttributes.sizeNumber && !selectedAttributes.color) {
      throw new Error(`Không thể phân tích variant: ${variant}`);
    }
    
    // DO NOT use existing AttributeLines - OVERWRITE mode
    // This will replace all variants on TPOS
    onProgress?.(`Đang tạo attribute lines mới (chế độ đè)...`);
    const newAttributeLines = createAttributeLines(selectedAttributes, []);
    
    onProgress?.(`Đang tạo variants mới (đè hết biến thể cũ)...`);
    const variants = generateVariants(originalProduct, newAttributeLines);
    
    onProgress?.(`Đang tạo payload...`);
    const payload = createPayload(originalProduct, newAttributeLines, variants);
    
    onProgress?.(`Đang upload lên TPOS...`);
    const result = await postTPOSVariantPayload(payload);
    
    onProgress?.(`✅ Tạo variant thành công`);
    return result;
    
  } catch (error) {
    console.error('Error creating TPOS variants:', error);
    throw error;
  }
}
