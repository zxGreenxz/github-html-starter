// TPOS Variant Uploader - Upload product with variants to TPOS and save returned variants to database
import { supabase } from "@/integrations/supabase/client";
import { parseVariantStringToAttributeLines } from "./variant-generator-adapter";
import { generateVariants, type TPOSAttributeLine, type ProductData as VariantProductData } from "./variant-generator";
import { updateTPOSProductWithVariants } from "./tpos-variant-update";

export interface ProductData {
  selling_price: number;
  purchase_price: number;
  product_images: string[];
  price_images: string[];
  supplier_name: string | null;
}

export interface VariantProduct {
  product_code: string;
  product_name: string;
  variant: string;
  selling_price: number;
  purchase_price: number;
  product_images: string[];
  price_images: string[];
  tpos_product_id: number;
  barcode: string;
}

export async function uploadToTPOSAndCreateVariants(
  productCode: string,
  productName: string,
  variantText: string,
  productData: ProductData,
  onProgress?: (message: string) => void
): Promise<VariantProduct[]> {
  console.log('🚀 START uploadToTPOSAndCreateVariants:', { productCode, productName, variantText });
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
      console.error('❌ No TPOS token found');
      throw new Error("Không tìm thấy TPOS token");
    }

    console.log('✅ Got TPOS token');
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
      // Product exists - create/update variants using new generator
      const tposProductId = checkData.value[0].Id;
      onProgress?.("🔄 Cập nhật variants trên TPOS...");
      
      // Parse variant text and generate variants
      const attributeLines = parseVariantStringToAttributeLines(variantText);
      const tempProduct: VariantProductData = {
        Id: tposProductId,
        Name: productName,
        DefaultCode: productCode,
        ListPrice: productData.selling_price
      };
      const generatedVariants = generateVariants(tempProduct, attributeLines);
      
      // Update product with new variants on TPOS
      await updateTPOSProductWithVariants(tposProductId, tempProduct, attributeLines, generatedVariants, bearerToken, onProgress);

      onProgress?.("✅ Cập nhật TPOS thành công");
      
      // Fetch created variants and save to products table
      const variants = await fetchAndSaveVariantsFromTPOS(tposProductId, productCode, productData, onProgress);
      return variants;
    } else {
      // Product doesn't exist - create new with variants
      onProgress?.("🆕 Tạo sản phẩm mới trên TPOS...");
      const variants = await createNewProductOnTPOS(productCode, productName, variantText, productData, headers, onProgress);
      return variants;
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
): Promise<VariantProduct[]> {
  // Parse variant text to attribute lines using new generator
  const attributeLines = parseVariantStringToAttributeLines(variantText);

  // Generate variants using new generator
  const tempProduct: VariantProductData = {
    Id: 0,
    Name: productName,
    DefaultCode: productCode,
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
    console.log('⚠️ TPOS returned 204 No Content');
    onProgress?.(`✅ Tạo TPOS thành công (${variants.length} variants)`);
    return [];
  }

  // Parse response and save variants
  const data = await response.json();
  console.log('📦 TPOS response data:', { Id: data.Id, Name: data.Name, ProductVariantCount: data.ProductVariants?.length });
  onProgress?.(`✅ Tạo TPOS thành công - ID: ${data.Id}`);

  if (data.Id) {
    console.log(`🔍 Calling fetchAndSaveVariantsFromTPOS with ID: ${data.Id}`);
    const variantProducts = await fetchAndSaveVariantsFromTPOS(data.Id, productCode, productData, onProgress);
    console.log(`✅ fetchAndSaveVariantsFromTPOS returned ${variantProducts.length} variants`);
    return variantProducts;
  }
  
  console.log('⚠️ No data.Id found, returning empty array');
  return [];
}

async function fetchAndSaveVariantsFromTPOS(
  tposProductId: number,
  baseProductCode: string,
  baseProductData: ProductData,
  onProgress?: (message: string) => void
): Promise<VariantProduct[]> {
  console.log('🔄 START fetchAndSaveVariantsFromTPOS:', { tposProductId, baseProductCode });
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
      console.error('❌ No TPOS token in fetchAndSaveVariantsFromTPOS');
      return [];
    }

    const headers = {
      'Authorization': `Bearer ${tokenData.bearer_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    onProgress?.("📥 Lấy danh sách variants từ TPOS...");
    
    // Fetch product with variants from TPOS
    const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=ProductVariants($expand=AttributeValues)`;
    console.log('📡 Fetching from TPOS URL:', url);
    const response = await fetch(url, { headers });
    console.log('📡 TPOS fetch response status:', response.status);

    if (!response.ok) {
      console.error('❌ Failed to fetch variants from TPOS:', response.status);
      return [];
    }

    const productData = await response.json();
    const variants = productData.ProductVariants || [];
    
    console.log(`📊 Fetched ${variants.length} variants from TPOS:`, variants);

    if (variants.length === 0) {
      onProgress?.("⚠️ Không tìm thấy variants trên TPOS");
      return [];
    }

    onProgress?.(`💾 Lưu ${variants.length} variants vào kho...`);

    // Lấy giá parent product từ DB (nếu tồn tại)
    const { data: parentProduct } = await supabase
      .from('products')
      .select('selling_price, purchase_price')
      .eq('product_code', baseProductCode)
      .maybeSingle();

    const parentSellingPrice = parentProduct?.selling_price || baseProductData.selling_price;
    const parentPurchasePrice = parentProduct?.purchase_price || baseProductData.purchase_price;

    // Prepare variant products to insert into database (prices in VND * 1000 format)
    const variantProducts = variants.map((variant: any) => {
      // Extract variant text from AttributeValues
      const variantText = variant.AttributeValues
        ?.map((attr: any) => attr.Name)
        .join(', ') || '';

      // Generate variant product code (base code + variant suffix if needed)
      const variantCode = variant.DefaultCode || baseProductCode;
      
      // Nếu variant có giá riêng trên TPOS → dùng giá đó
      // Nếu không → fallback về giá parent
      const sellingPriceVND = (variant.PriceVariant && variant.PriceVariant > 0) 
        ? variant.PriceVariant 
        : parentSellingPrice;
      const purchasePriceVND = (variant.PurchasePrice && variant.PurchasePrice > 0)
        ? variant.PurchasePrice
        : parentPurchasePrice;

      return {
        product_code: variantCode,
        product_name: variant.Name || variant.NameGet,
        variant: variantText,
        selling_price: sellingPriceVND, // Store actual VND from TPOS
        purchase_price: purchasePriceVND, // Store actual VND from TPOS
        stock_quantity: variant.QtyAvailable || 0,
        supplier_name: baseProductData.supplier_name,
        product_images: baseProductData.product_images, // Copy images from base product
        price_images: baseProductData.price_images,
        base_product_code: baseProductCode,
        tpos_product_id: variant.Id,
        productid_bienthe: variant.Id,
        tpos_image_url: variant.ImageUrl || null, // Store TPOS image URL only, don't copy to Supabase
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
    
    // Also update purchase_order_items with tpos_product_id for each variant
    const variantCodesToUpdate = variantProducts.map(vp => vp.product_code);
    
    if (variantCodesToUpdate.length > 0) {
      console.log(`[TPOS Variant Uploader] Updating purchase_order_items for ${variantCodesToUpdate.length} variant codes`);
      
      const { error: poUpdateError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_product_id: tposProductId,
          updated_at: new Date().toISOString()
        })
        .in('product_code', variantCodesToUpdate);
      
      if (poUpdateError) {
        console.error("[TPOS Variant Uploader] Failed to update purchase_order_items:", poUpdateError);
      } else {
        console.log(`[TPOS Variant Uploader] ✅ Updated purchase_order_items for variants`);
      }
    }
    
    // Return the variant products for adding to purchase order (prices in VND format for UI)
    const resultVariants = variantProducts.map(vp => ({
      product_code: vp.product_code,
      product_name: vp.product_name,
      variant: vp.variant || '',
      selling_price: vp.selling_price / 1000, // Convert from DB format to UI format (VND)
      purchase_price: vp.purchase_price / 1000, // Convert from DB format to UI format (VND)
      product_images: vp.product_images || [], // Return images from base product
      price_images: vp.price_images || [],
      tpos_product_id: vp.tpos_product_id,
      tpos_image_url: vp.tpos_image_url, // Return TPOS image URL
      barcode: vp.barcode
    }));
    
    console.log(`✅ Returning ${resultVariants.length} variants to add to purchase order:`, resultVariants);
    
    return resultVariants;
  } catch (error: any) {
    console.error("Error fetching/saving variants:", error);
    throw error;
  }
}
