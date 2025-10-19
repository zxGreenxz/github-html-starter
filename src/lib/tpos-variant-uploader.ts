// TPOS Variant Uploader - Upload product with variants to TPOS and save returned variants to database
import { supabase } from "@/integrations/supabase/client";
import { createTPOSVariants, parseVariantToAttributes, createAttributeLines, generateVariants } from "./tpos-variant-creator";

export interface ProductData {
  selling_price: number;
  purchase_price: number;
  product_images: string[];
  price_images: string[];
  supplier_name: string | null;
}

export async function uploadToTPOSAndCreateVariants(
  productCode: string,
  productName: string,
  variantText: string,
  productData: ProductData,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    // Get TPOS token
    const { data: tokenData } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenData?.bearer_token) {
      throw new Error("Không tìm thấy TPOS token");
    }

    const bearerToken = tokenData.bearer_token;
    const headers = {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://tomato.tpos.vn/',
      'Origin': 'https://tomato.tpos.vn',
      'x-request-id': crypto.randomUUID()
    };

    // Check if product exists on TPOS
    onProgress?.("🔍 Kiểm tra sản phẩm trên TPOS...");
    const checkUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${productCode}`;
    const checkResponse = await fetch(checkUrl, { headers });
    const checkData = await checkResponse.json();

    if (checkData.value && checkData.value.length > 0) {
      // Product exists - use variant creator to update variants
      const tposProductId = checkData.value[0].Id;
      onProgress?.("🔄 Cập nhật variants trên TPOS...");
      
      await createTPOSVariants(tposProductId, variantText, (message) => {
        console.log(`📝 TPOS Variant Creator: ${message}`);
        onProgress?.(message);
      });

      onProgress?.("✅ Cập nhật TPOS thành công");
      
      // Fetch created variants and save to products table
      await fetchAndSaveVariantsFromTPOS(tposProductId, productCode, productData, onProgress);
    } else {
      // Product doesn't exist - create new with variants
      onProgress?.("🆕 Tạo sản phẩm mới trên TPOS...");
      await createNewProductOnTPOS(productCode, productName, variantText, productData, headers, onProgress);
    }
  } catch (error: any) {
    console.error("TPOS upload error:", error);
    throw error;
  }
}

async function createNewProductOnTPOS(
  productCode: string,
  productName: string,
  variantText: string,
  productData: ProductData,
  headers: any,
  onProgress?: (message: string) => void
): Promise<void> {
  // Parse variant text to attribute lines
  const selectedAttributes = parseVariantToAttributes(variantText);
  const attributeLines = createAttributeLines(selectedAttributes);

  // Generate variants
  const tempProduct = {
    Id: 0,
    Name: productName,
    ListPrice: productData.selling_price
  };
  
  const variants = generateVariants(tempProduct, attributeLines);

  // Convert first image to base64 if exists
  let imageBase64: string | null = null;
  if (productData.product_images && productData.product_images.length > 0) {
    const imageUrl = productData.product_images[0];
    try {
      onProgress?.("📷 Đang chuyển đổi ảnh...");
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn("Failed to convert image to base64:", err);
    }
  }

  // Create payload
  const payload = {
    Id: 0,
    Name: productName,
    Type: "product",
    ListPrice: productData.selling_price,
    PurchasePrice: productData.purchase_price,
    DefaultCode: productCode,
    Image: imageBase64,
    ImageUrl: null,
    Thumbnails: [],
    AttributeLines: attributeLines,
    ProductVariants: variants,
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
    UOM: { Id: 1, Name: "Cái", Rounding: 0.001, Active: true, Factor: 1, FactorInv: 1, UOMType: "reference", CategoryId: 1, CategoryName: "Đơn vị" },
    UOMPO: { Id: 1, Name: "Cái", Rounding: 0.001, Active: true, Factor: 1, FactorInv: 1, UOMType: "reference", CategoryId: 1, CategoryName: "Đơn vị" },
    Categ: { Id: 2, Name: "Có thể bán", CompleteName: "Có thể bán", Type: "normal", PropertyCostMethod: "average", NameNoSign: "Co the ban", IsPos: true },
    Items: [],
    UOMLines: [],
    ComboProducts: [],
    ProductSupplierInfos: []
  };

  onProgress?.(`🚀 Tạo sản phẩm với ${variants.length} variants...`);
  
  // Create product
  const createUrl = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO';
  const response = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TPOS API Error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    onProgress?.(`✅ Tạo TPOS thành công (${variants.length} variants)`);
    return;
  }

  // Parse response and save variants
  const data = await response.json();
  onProgress?.(`✅ Tạo TPOS thành công - ID: ${data.Id}`);

  if (data.Id) {
    await fetchAndSaveVariantsFromTPOS(data.Id, productCode, productData, onProgress);
  }
}

async function fetchAndSaveVariantsFromTPOS(
  tposProductId: number,
  baseProductCode: string,
  baseProductData: ProductData,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    // Get TPOS token
    const { data: tokenData } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenData?.bearer_token) return;

    const headers = {
      'Authorization': `Bearer ${tokenData.bearer_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    onProgress?.("📥 Lấy danh sách variants từ TPOS...");
    
    // Fetch product with variants from TPOS
    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=ProductVariants($expand=AttributeValues)`;
    const response = await fetch(url, { headers });

    if (!response.ok) return;

    const productData = await response.json();
    const variants = productData.ProductVariants || [];

    if (variants.length === 0) {
      onProgress?.("⚠️ Không tìm thấy variants trên TPOS");
      return;
    }

    onProgress?.(`💾 Lưu ${variants.length} variants vào kho...`);

    // Prepare variant products to insert
    const variantProducts = variants.map((variant: any) => {
      // Extract variant text from AttributeValues
      const variantText = variant.AttributeValues
        ?.map((attr: any) => attr.Name)
        .join(', ') || '';

      // Generate variant product code (base code + variant suffix if needed)
      const variantCode = variant.DefaultCode || baseProductCode;

      return {
        product_code: variantCode,
        product_name: variant.Name || variant.NameGet,
        variant: variantText,
        selling_price: variant.PriceVariant || baseProductData.selling_price,
        purchase_price: variant.PurchasePrice || baseProductData.purchase_price,
        stock_quantity: variant.QtyAvailable || 0,
        supplier_name: baseProductData.supplier_name,
        product_images: variant.ImageUrl ? [variant.ImageUrl] : baseProductData.product_images,
        price_images: baseProductData.price_images,
        base_product_code: baseProductCode,
        tpos_product_id: variant.Id,
        productid_bienthe: variant.Id,
        tpos_image_url: variant.ImageUrl || null,
        barcode: variant.Barcode || variantCode
      };
    });

    // Upsert variants to products table
    const { error: upsertError } = await supabase
      .from('products')
      .upsert(variantProducts, {
        onConflict: 'product_code',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error("Error upserting variants:", upsertError);
      throw upsertError;
    }

    onProgress?.(`✅ Đã lưu ${variants.length} variants vào kho thành công`);
  } catch (error: any) {
    console.error("Error fetching/saving variants:", error);
    throw error;
  }
}
