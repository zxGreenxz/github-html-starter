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

  // ✅ STEP 2: Fallback to old format if no parentheses found
  if (groups.length === 0) {
    const cleanStr = variantStr.replace(/[()]/g, '');
    const parts = cleanStr
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (parts.length > 0) {
      groups.push(parts.join(' | '));
    }
  }

  // ✅ STEP 3: Process each group
  for (const group of groups) {
    // Split by pipe |
    const values = group
      .split('|')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    // Try to match each value with TPOS attributes
    for (const value of values) {
      const valueUpper = value.toUpperCase();
      
      Object.entries(ATTRIBUTE_MAP).forEach(([attrId, attrInfo]) => {
        // ✅ STEP 1: Prioritize exact match (Name or Code)
        let matchedValue = attrInfo.values.find(
          v => v.Name.toUpperCase() === valueUpper || 
               v.Code.toUpperCase() === valueUpper
        );
        
        // ✅ STEP 2: Fallback to includes() only if no exact match
        if (!matchedValue) {
          matchedValue = attrInfo.values.find(
            v => valueUpper.includes(v.Name.toUpperCase())
          );
        }

        if (matchedValue) {
          const id = parseInt(attrId);
          let line = attributeLines.find(l => l.AttributeId === id);
          
          if (!line) {
            line = {
              Attribute: {
                Id: id,
                Name: attrInfo.name,
                Code: attrInfo.code,
                Sequence: null,
                CreateVariant: true
              },
              Values: [],
              AttributeId: id
            };
            attributeLines.push(line);
          }

          // Avoid duplicates
          if (!line.Values.find(v => v.Id === matchedValue.Id)) {
            line.Values.push({
              Id: matchedValue.Id,
              Name: matchedValue.Name,
              Code: matchedValue.Code,
              Sequence: matchedValue.Sequence,
              AttributeId: id,
              AttributeName: attrInfo.name,
              PriceExtra: null,
              NameGet: `${attrInfo.name}: ${matchedValue.Name}`,
              DateCreated: null
            });
          }
        }
      });
    }
  }

  return attributeLines;
}

/**
 * Build attribute lines from inventory variants
 */
function buildAttributeLinesFromInventory(variants: VariantFromInventory[]): AttributeLine[] {
  const attributeLines: AttributeLine[] = [];

  for (const variant of variants) {
    if (!variant.variant) continue;
    
    const lines = parseVariantToAttributeLines(variant.variant);
    
    // Merge with existing attribute lines
    for (const line of lines) {
      let existingLine = attributeLines.find(l => l.AttributeId === line.AttributeId);
      
      if (!existingLine) {
        attributeLines.push(line);
      } else {
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
    onProgress?.('🔍 Đang tải variants từ kho...');

    // STEP 1: Query variants from database
    const { data: variants, error: variantsError } = await supabase
      .from('products')
      .select('product_code, variant, product_name, selling_price, purchase_price, product_images')
      .eq('base_product_code', baseProductCode)
      .not('variant', 'is', null)
      .neq('variant', '');

    if (variantsError) throw variantsError;

    if (!variants || variants.length === 0) {
      return {
        success: false,
        error: '❌ Không tìm thấy variants trong kho. Vui lòng dùng chế độ thủ công.'
      };
    }

    onProgress?.(`✅ Tìm thấy ${variants.length} variants trong kho`);

    // STEP 2: Load base product info
    const { data: baseProduct, error: baseError } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', baseProductCode)
      .eq('base_product_code', baseProductCode)
      .single();

    if (baseError || !baseProduct) {
      throw new Error('Không tìm thấy sản phẩm gốc');
    }

    // STEP 3: Build attribute lines from inventory
    onProgress?.('🔨 Đang xây dựng attribute lines...');
    const attributeLines = buildAttributeLinesFromInventory(variants as any);

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

    // STEP 2: Preview variants (SuggestionsVariant)
    onProgress?.('🔍 [1/3] Đang tạo preview variants...');
    
    const previewPayload = {
      model: {
        ...cleanData,
        AttributeLines: attributeLines,
        ProductVariants: [] // Let TPOS generate
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
      throw new Error(`Preview failed: ${errorData.error?.message || previewResponse.status}`);
    }

    const previewData = await previewResponse.json();
    onProgress?.(`✅ Preview: ${previewData.value?.length || 0} variants`);

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
