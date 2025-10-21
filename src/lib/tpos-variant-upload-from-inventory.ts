/**
 * TPOS Variant Upload from Inventory
 * Implements 3-step upload process: Preview → Save → Verify
 * Uses existing variants from products table
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

// ==================== MAIN UPLOAD FUNCTION ====================

export interface UploadFromInventoryResult {
  success: boolean;
  tposProductId?: number;
  variantsUploaded?: number;
  variantsMissing?: string[];
  error?: string;
}

/**
 * Upload product with variants from inventory using 3-step process
 * Step 1: Preview (SuggestionsVariant)
 * Step 2: Save (UpdateV2)
 * Step 3: Verify (GET)
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

    // STEP 2: Get variant text from parent product
    const variantText = baseProduct.variant || '';
    
    if (!variantText) {
      return {
        success: false,
        error: '❌ Sản phẩm cha không có thông tin variants'
      };
    }

    onProgress?.(`✅ Variant text: ${variantText}`);

    // STEP 3: Parse variant text to attribute lines
    onProgress?.('🔨 Đang parse variants từ sản phẩm cha...');
    const attributeLines = parseVariantToAttributeLines(variantText);

    if (attributeLines.length === 0) {
      return {
        success: false,
        error: '❌ Không thể parse variants. Dữ liệu variants không hợp lệ.'
      };
    }

    onProgress?.(`✅ Đã tạo ${attributeLines.length} attribute lines`);

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

    // ====== BƯỚC 2: UpdateV2 - THÊM VARIANTS (3-STEP NHƯ HTML) ======
    onProgress?.('🔄 [2/2] Đang thêm variants bằng UpdateV2...');
    
    return await updateExistingProductVariants(
      tposProductId,
      baseProduct,
      attributeLines,
      headers,
      onProgress
    );

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
    // STEP 1: Fetch existing product data
    onProgress?.('📥 Đang tải dữ liệu sản phẩm hiện tại...');
    
    const fetchUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMPO,Categ,ProductVariants($expand=AttributeValues)`;
    const fetchResponse = await fetch(fetchUrl, { headers });
    
    if (!fetchResponse.ok) {
      throw new Error('Không thể tải dữ liệu sản phẩm từ TPOS');
    }
    
    const existingData = await fetchResponse.json();
    const cleanData = removeODataMetadata(existingData);

    // STEP 2: Preview variants (SuggestionsVariant) - POST TUẦN TỰ 3 LẦN
    onProgress?.('🔍 [1/3] Đang tạo preview variants (3 bước)...');
    
    let currentAttributeLines: AttributeLine[] = [];
    let finalPreviewData: any;

    for (let i = 0; i < attributeLines.length; i++) {
      currentAttributeLines.push(attributeLines[i]);
      
      onProgress?.(
        `🔍 [Preview ${i+1}/${attributeLines.length}] ${attributeLines[i].Attribute.Name} (${attributeLines[i].Values.length} values)...`
      );
      
      const previewPayload = {
        model: {
          ...cleanData,
          AttributeLines: currentAttributeLines,
          ProductVariants: []
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
          `Preview step ${i+1} failed: ${errorData.error?.message || previewResponse.status}`
        );
      }

      finalPreviewData = await previewResponse.json();
      onProgress?.(
        `✅ Preview ${i+1}: ${finalPreviewData.value?.length || 0} variants`
      );
    }

    const previewData = finalPreviewData;
    onProgress?.(`✅ Hoàn tất preview: ${previewData.value?.length || 0} variants tổng cộng`);

    // STEP 3: Save to database (UpdateV2)
    onProgress?.('💾 [2/3] Đang lưu vào TPOS database...');
    
    const savePayload = {
      ...cleanData,
      ProductVariants: previewData.value,
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

    // STEP 4: Verify (GET)
    onProgress?.('🔍 [3/3] Đang xác minh dữ liệu...');
    
    const verifyUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=ProductVariants($expand=AttributeValues)`;
    const verifyResponse = await fetch(verifyUrl, { headers });
    
    if (!verifyResponse.ok) {
      throw new Error('Verify failed');
    }

    const verifiedData = await verifyResponse.json();
    const savedVariants = verifiedData.ProductVariants || [];

    onProgress?.(`✅ Xác minh: ${savedVariants.length} variants đã lưu`);

    // Compare expected vs actual
    const expectedCount = previewData.value?.length || 0;
    const actualCount = savedVariants.length;
    
    if (actualCount !== expectedCount) {
      console.warn(`⚠️ Expected ${expectedCount} variants, got ${actualCount}`);
    }

    // Update local database
    await updateDatabaseAfterUpload(baseProduct.product_code, tposProductId, savedVariants);

    return {
      success: true,
      tposProductId,
      variantsUploaded: actualCount
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
