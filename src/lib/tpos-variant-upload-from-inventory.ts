/**
 * TPOS Variant Upload from Inventory
 * Implements 5-step upload process (giống HTML reference):
 * Step 1: Fetch existing product data
 * Step 2: Generate variants locally (Cartesian product)
 * Step 3: Preview (POST 1 lần với ProductVariants + AttributeLines)
 * Step 4: Save (UpdateV2)
 * Step 5: Verify (GET)
 */

import { supabase } from "@/integrations/supabase/client";
import { getActiveTPOSToken, getTPOSHeaders } from "./tpos-config";
import { TPOS_ATTRIBUTES } from "./tpos-attributes";

// ==================== TYPE DEFINITIONS ====================

interface AttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId?: number;
  AttributeName?: string;
  PriceExtra?: number | null;
  NameGet?: string;
  DateCreated?: string | null;
}

interface AttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: number | null;
    CreateVariant: boolean;
  };
  Values: AttributeValue[];
  AttributeId: number;
}

interface VariantFromInventory {
  product_code: string;
  variant: string;
  product_name: string;
  selling_price: number;
  purchase_price: number;
  product_images?: string[] | null;
}

interface TPOSVariant {
  Id: number;
  Name: string;
  DefaultCode: string;
  AttributeValues: AttributeValue[];
  PriceVariant: number;
  Active: boolean;
}

// ==================== ATTRIBUTE MAPPING ====================

const ATTRIBUTE_MAP = {
  1: { name: "Size Chữ", code: "SZCh", values: TPOS_ATTRIBUTES.sizeText },
  3: { name: "Màu", code: "Mau", values: TPOS_ATTRIBUTES.color },
  4: { name: "Size Số", code: "SZNu", values: TPOS_ATTRIBUTES.sizeNumber },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse variant string to attribute lines
 * Supports both formats:
 * - New: "(Đen Trắng) (S M L)"
 * - Old: "Đen, Trắng, S, M, L"
 */
function parseVariantToAttributeLines(variantStr: string): AttributeLine[] {
  if (!variantStr || variantStr.trim() === '') return [];

  const attributeLines: AttributeLine[] = [];

  // ✅ STEP 1: Parse groups in parentheses ()
  const groupPattern = /\(([^)]+)\)/g;
  const groups: string[] = [];
  let match;
  
  while ((match = groupPattern.exec(variantStr)) !== null) {
    groups.push(match[1]);
  }

  // ✅ STEP 2: Fallback to old comma-separated format
  if (groups.length === 0) {
    const cleanStr = variantStr.replace(/[()]/g, '');
    const parts = cleanStr.split(/[\s,]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Group by attribute type
    const sizeNumGroup: string[] = [];
    const sizeTextGroup: string[] = [];
    const colorGroup: string[] = [];
    
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        sizeNumGroup.push(part);
      } else if (part.length <= 4 && /^[A-Z]+$/i.test(part)) {
        sizeTextGroup.push(part);
      } else {
        colorGroup.push(part);
      }
    }
    
    // Rebuild groups theo thứ tự: Size Số → Size Chữ → Màu
    if (sizeNumGroup.length > 0) groups.push(sizeNumGroup.join(' | '));
    if (sizeTextGroup.length > 0) groups.push(sizeTextGroup.join(' | '));
    if (colorGroup.length > 0) groups.push(colorGroup.join(' | '));
  }

  // ✅ STEP 3: Process each group và XÁC ĐỊNH AttributeId
  for (const group of groups) {
    const values = group.split('|').map(v => v.trim()).filter(v => v.length > 0);
    
    if (values.length === 0) continue;

    // ✅ DETECT attribute type từ first value
    let detectedAttributeId: number | null = null;
    
    // Check if group is Size Số (all numbers)
    if (values.every(v => /^\d+$/.test(v))) {
      detectedAttributeId = 4; // Size Số
    }
    // Check if group is Size Chữ (short uppercase letters)
    else if (values.every(v => v.length <= 4 && /^[A-Z]+$/i.test(v))) {
      detectedAttributeId = 1; // Size Chữ
    }
    // Otherwise, it's Color
    else {
      detectedAttributeId = 3; // Màu
    }

    // ✅ STEP 4: Match values với TPOS attributes
    if (detectedAttributeId) {
      const attrInfo = ATTRIBUTE_MAP[detectedAttributeId];
      
      const matchedValues = values
        .map(v => {
          const valueUpper = v.toUpperCase();
          return attrInfo.values.find(
            av => av.Name.toUpperCase() === valueUpper || 
                  av.Code.toUpperCase() === valueUpper
          );
        })
        .filter(v => v !== undefined);

      if (matchedValues.length > 0) {
        attributeLines.push({
          Attribute: {
            Id: detectedAttributeId,
            Name: attrInfo.name,
            Code: attrInfo.code,
            Sequence: null,
            CreateVariant: true
          },
          Values: matchedValues.map(v => ({
            Id: v!.Id,
            Name: v!.Name,
            Code: v!.Code,
            Sequence: v!.Sequence,
            AttributeId: detectedAttributeId,
            AttributeName: attrInfo.name,
            PriceExtra: null,
            NameGet: `${attrInfo.name}: ${v!.Name}`,
            DateCreated: null
          })),
          AttributeId: detectedAttributeId
        });
      }
    }
  }

  return attributeLines;
}

/**
 * Build attribute lines from inventory variants
 */
function buildAttributeLinesFromInventory(variants: VariantFromInventory[]): AttributeLine[] {
  if (variants.length === 0) return [];
  
  // ✅ Parse variant đầu tiên để lấy thứ tự attributes
  const firstVariant = variants[0];
  const attributeLines = parseVariantToAttributeLines(firstVariant.variant);
  
  // ✅ Merge values từ các variants khác
  for (let i = 1; i < variants.length; i++) {
    const lines = parseVariantToAttributeLines(variants[i].variant);
    
    for (const line of lines) {
      const existingLine = attributeLines.find(l => l.AttributeId === line.AttributeId);
      
      if (existingLine) {
        // Merge values without duplicates
        for (const value of line.Values) {
          if (!existingLine.Values.find(v => v.Id === value.Id)) {
            existingLine.Values.push(value);
          }
        }
      }
    }
  }
  
  return attributeLines;
}

/**
 * Remove OData metadata from objects
 */
function removeODataMetadata(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeODataMetadata(item));
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (!key.startsWith('@odata.')) {
        cleaned[key] = removeODataMetadata(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Load image as Base64
 */
async function loadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load image:', error);
    return null;
  }
}

/**
 * Generate unique SKU code (giống HTML reference)
 * @param baseCode - Base product code (e.g., "NTEST")
 * @param attrs - Array of attribute values
 * @param existingCodes - Set of existing codes to avoid duplicates
 * @returns Generated SKU code (e.g., "NTEST37ST")
 */
function generateSKU(
  baseCode: string,
  attrs: any[],
  existingCodes: Set<string>
): string {
  let code = baseCode;
  
  // 🆕 TRƯỜNG HỢP ĐẶC BIỆT: Nếu chỉ có 1 attribute và là "Size Số"
  const isSingleSizeNumber = 
    attrs.length === 1 && 
    (attrs[0].AttributeName === "Size Số" || attrs[0].AttributeId === 4);
  
  if (isSingleSizeNumber) {
    code += 'A';  // ✅ Thêm "A" trước số (e.g., "TEST3213A37")
  }
  
  // Duyệt theo thứ tự tự nhiên (KHÔNG SORT)
  for (const attr of attrs) {
    const attrCode = attr.Code || attr.Name;
    if (/^\d+$/.test(attrCode)) {
      // Số giữ nguyên (e.g., "37" -> "37")
      code += attrCode;
    } else {
      // Chữ lấy ký tự đầu uppercase (e.g., "TRẮNG KEM" -> "T", "S" -> "S")
      code += attrCode.charAt(0).toUpperCase();
    }
  }
  
  // Handle duplicates bằng cách thêm "1", "11", "111"...
  let finalCode = code;
  let counter = 0;
  
  while (existingCodes.has(finalCode)) {
    counter++;
    finalCode = code + '1'.repeat(counter);
  }
  
  existingCodes.add(finalCode);
  return finalCode;
}

/**
 * Generate all variant combinations (giống HTML reference)
 * Tạo Cartesian product của tất cả attribute values
 * @param baseProduct - Base product from inventory
 * @param attributeLines - Attribute lines từ variant text
 * @returns Array of TPOS variant objects
 */
function generateVariantCombinations(
  baseProduct: any,
  attributeLines: AttributeLine[]
): TPOSVariant[] {
  if (attributeLines.length === 0) return [];
  
  const combinations: any[][] = [];
  
  // Tạo Cartesian product
  function generate(index: number, current: any[]) {
    if (index === attributeLines.length) {
      combinations.push([...current]);
      return;
    }
    
    const line = attributeLines[index];
    for (const value of line.Values) {
      generate(index + 1, [
        ...current,
        {
          AttributeId: line.Attribute.Id,
          AttributeName: line.Attribute.Name,
          Id: value.Id,
          Name: value.Name,
          Code: value.Code,
          Sequence: value.Sequence,
          PriceExtra: value.PriceExtra || null
        }
      ]);
    }
  }
  
  generate(0, []);
  
  // Generate SKU codes
  const existingCodes = new Set<string>();
  const baseCode = baseProduct.product_code;
  
  return combinations.map(attrs => {
    // ✅ KHÔNG SORT - giữ nguyên thứ tự từ attributeLines
    // Thứ tự trong () sẽ theo đúng thứ tự attribute lines
    const variantName = `${baseProduct.product_name} (${attrs.map(a => a.Name).join(', ')})`;
    
    // Tạo mã SKU theo thứ tự tự nhiên
    const variantCode = generateSKU(baseCode, attrs, existingCodes);
    
    return {
      Id: 0,
      Name: variantName,
      DefaultCode: variantCode,
      AttributeValues: attrs,
      Active: true,
      PriceVariant: baseProduct.selling_price || 0
    };
  });
}

// ==================== MAIN UPLOAD FUNCTION ====================

export interface UploadFromInventoryResult {
  success: boolean;
  tposProductId?: number;
  variantsUploaded?: number;
  variantsMissing?: string[];
  error?: string;
}

/**
 * Upload product with variants from inventory (giống HTML reference)
 * Flow: Load base product → Parse variant text → Generate variants locally → 
 *       Preview (1 POST) → Save → Verify
 */
export async function uploadTPOSFromInventoryVariants(
  baseProductCode: string,
  onProgress?: (message: string) => void
): Promise<UploadFromInventoryResult> {
  try {
    onProgress?.('🔍 Đang tìm sản phẩm cha trong kho...');

    // STEP 1: Load base product (parent product) info
    const { data: baseProduct, error: baseError } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', baseProductCode)
      .single();

    if (baseError || !baseProduct) {
      return {
        success: false,
        error: '❌ Không tìm thấy sản phẩm cha trong kho'
      };
    }

    // STEP 2: Get variant text from parent product (cho phép rỗng)
    const variantText = baseProduct.variant || '';
    let attributeLines: AttributeLine[] = [];

    if (variantText) {
      // Có variants → parse
      onProgress?.(`✅ Variant text: ${variantText}`);
      onProgress?.('🔨 Đang parse variants từ sản phẩm cha...');
      attributeLines = parseVariantToAttributeLines(variantText);
      
      if (attributeLines.length === 0) {
        onProgress?.('⚠️ Parse variants thất bại, sẽ upload không có variants');
      } else {
        onProgress?.(`✅ Đã tạo ${attributeLines.length} attribute lines`);
      }
    } else {
      // Không có variants → upload sản phẩm đơn giản
      onProgress?.('ℹ️ Sản phẩm không có variants, sẽ upload dạng đơn giản');
    }

    // STEP 4: Get TPOS token and headers
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error('Không tìm thấy TPOS token');
    }

    const headers = getTPOSHeaders(token);

    // STEP 5: Check if product already exists on TPOS
    onProgress?.('🔍 Kiểm tra sản phẩm trên TPOS...');
    const checkUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${baseProductCode}`;
    const checkResponse = await fetch(checkUrl, { headers });
    const checkData = await checkResponse.json();

    const existingProduct = checkData.value?.[0];
    
    if (existingProduct) {
      onProgress?.('🔄 Sản phẩm đã tồn tại, đang cập nhật variants...');
      return await updateExistingProductVariants(
        existingProduct.Id,
        baseProduct,
        attributeLines,
        headers,
        onProgress
      );
    } else {
      onProgress?.('🆕 Tạo sản phẩm mới với variants...');
      return await createNewProductWithVariants(
        baseProduct,
        attributeLines,
        headers,
        onProgress
      );
    }

  } catch (error: any) {
    console.error('[Upload from inventory] Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// ==================== CREATE NEW PRODUCT ====================

async function createNewProductWithVariants(
  baseProduct: any,
  attributeLines: AttributeLine[],
  headers: HeadersInit,
  onProgress?: (message: string) => void
): Promise<UploadFromInventoryResult> {
  try {
    // Load image
    let imageBase64: string | null = null;
    if (baseProduct.product_images && baseProduct.product_images.length > 0) {
      onProgress?.('📸 Đang tải hình ảnh...');
      imageBase64 = await loadImageAsBase64(baseProduct.product_images[0]);
    }

    // ====== BƯỚC 1: InsertV2 - TẠO BASE PRODUCT (KHÔNG CÓ VARIANTS) ======
    const basePayload = {
      Id: 0,
      Name: baseProduct.product_name,
      Type: "product",
      ListPrice: baseProduct.selling_price || 0,
      PurchasePrice: baseProduct.purchase_price || 0,
      DefaultCode: baseProduct.product_code,
      Image: imageBase64,
      // ❌ KHÔNG GỬI AttributeLines ở đây
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
    };

    onProgress?.('📤 [1/2] Đang tạo base product trên TPOS...');

    // Call InsertV2 API (WITHOUT variants)
    const createUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2';
    const response = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(basePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const tposResponse = await response.json();
    const tposProductId = tposResponse.Id;

    if (!tposProductId) {
      throw new Error('Không lấy được TPOS Product ID');
    }

    onProgress?.(`✅ Đã tạo base product (ID: ${tposProductId})`);

    // ====== BƯỚC 2: Nếu có variants → thêm bằng UpdateV2 ======
    if (attributeLines.length > 0) {
      onProgress?.('🔄 [2/2] Đang thêm variants bằng UpdateV2...');
      return await updateExistingProductVariants(
        tposProductId,
        baseProduct,
        attributeLines,
        headers,
        onProgress
      );
    } else {
      // Không có variants → hoàn tất
      onProgress?.('✅ Đã tạo sản phẩm đơn giản (không có variants)');
      return {
        success: true,
        tposProductId,
        variantsUploaded: 0
      };
    }

  } catch (error: any) {
    throw new Error(`Lỗi tạo sản phẩm mới: ${error.message}`);
  }
}

// ==================== UPDATE EXISTING PRODUCT ====================

async function updateExistingProductVariants(
  tposProductId: number,
  baseProduct: any,
  attributeLines: AttributeLine[],
  headers: HeadersInit,
  onProgress?: (message: string) => void
): Promise<UploadFromInventoryResult> {
  try {
    // Nếu không có variants → không cần update
    if (attributeLines.length === 0) {
      onProgress?.('ℹ️ Sản phẩm không có variants, bỏ qua bước update variants');
      return {
        success: true,
        tposProductId,
        variantsUploaded: 0
      };
    }

    // STEP 1: Fetch existing product data
    onProgress?.('📥 Đang tải dữ liệu sản phẩm hiện tại...');
    
    const fetchUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMPO,Categ,ProductVariants($expand=AttributeValues)`;
    const fetchResponse = await fetch(fetchUrl, { headers });
    
    if (!fetchResponse.ok) {
      throw new Error('Không thể tải dữ liệu sản phẩm từ TPOS');
    }
    
    const existingData = await fetchResponse.json();
    const cleanData = removeODataMetadata(existingData);

    // STEP 2: Generate variants locally (giống HTML reference)
    onProgress?.('🔨 Đang generate variants local...');
    const generatedVariants = generateVariantCombinations(baseProduct, attributeLines);
    onProgress?.(`✅ Đã generate ${generatedVariants.length} variants`);

    // STEP 3: Preview variants - POST 1 LẦN với đầy đủ data (giống HTML)
    onProgress?.('🔍 [1/2] Đang gửi preview request...');
    
    const previewPayload = {
      model: {
        ...cleanData,
        ProductVariants: generatedVariants,  // ✅ Gửi KÈM variants đã generate
        AttributeLines: attributeLines       // ✅ Gửi attribute lines
      }
    };

    const previewResponse = await fetch(
      'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.SuggestionsVariant?$expand=AttributeValues',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(previewPayload)
      }
    );

    if (!previewResponse.ok) {
      const errorData = await previewResponse.json();
      throw new Error(
        `Preview failed: ${errorData.error?.message || previewResponse.status}`
      );
    }

    const previewData = await previewResponse.json();
    onProgress?.(`✅ Preview: ${previewData.value?.length || 0} variants`);

    // STEP 4: Save to database (UpdateV2)
    onProgress?.('💾 [2/2] Đang lưu vào TPOS database...');
    
    const savePayload = {
      ...cleanData,
      ListPrice: baseProduct.selling_price || 0,      // ✅ Sync giá bán MỚI từ DB
      PurchasePrice: baseProduct.purchase_price || 0, // ✅ Sync giá mua MỚI từ DB
      ProductVariants: previewData.value.map((variant: any) => ({
        ...variant,              // ✅ Giữ TẤT CẢ thông tin khác
        ListPrice: null,         // ✅ Clear để inherit từ cha
        PurchasePrice: null      // ✅ Clear để inherit từ cha
      })),
      AttributeLines: attributeLines,
      Version: existingData.Version || 0
    };

    const saveResponse = await fetch(
      'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(savePayload)
      }
    );

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json();
      throw new Error(`Save failed: ${errorData.error?.message || saveResponse.status}`);
    }

    onProgress?.('✅ Đã lưu thành công');

    // Use preview data directly (no verification step needed)
    const uploadedCount = previewData.value?.length || 0;
    
    // Update local database
    await updateDatabaseAfterUpload(baseProduct.product_code, tposProductId, previewData.value || []);

    return {
      success: true,
      tposProductId,
      variantsUploaded: uploadedCount
    };

  } catch (error: any) {
    throw new Error(`Lỗi cập nhật variants: ${error.message}`);
  }
}

// ==================== DATABASE UPDATE ====================

async function updateDatabaseAfterUpload(
  baseProductCode: string,
  tposProductId: number,
  variantsFromTPOS: TPOSVariant[]
) {
  // Update parent product
  await supabase
    .from('products')
    .update({ 
      tpos_product_id: tposProductId,
      updated_at: new Date().toISOString()
    })
    .eq('product_code', baseProductCode)
    .eq('base_product_code', baseProductCode);

  // Update purchase_order_items
  await supabase
    .from('purchase_order_items')
    .update({ 
      tpos_product_id: tposProductId,
      updated_at: new Date().toISOString()
    })
    .eq('product_code', baseProductCode);

  // Map variant IDs by product_code
  const variantIdMap = variantsFromTPOS.reduce((acc, variant) => {
    if (variant.DefaultCode) {
      acc[variant.DefaultCode] = variant.Id;
    }
    return acc;
  }, {} as Record<string, number>);

  // Update productid_bienthe for variants
  for (const [productCode, variantId] of Object.entries(variantIdMap)) {
    await supabase
      .from('products')
      .update({ 
        productid_bienthe: variantId,
        updated_at: new Date().toISOString()
      })
      .eq('product_code', productCode);
  }
}
