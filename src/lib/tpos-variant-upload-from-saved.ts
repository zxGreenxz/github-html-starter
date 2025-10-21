import { supabase } from "@/integrations/supabase/client";

export async function uploadToTPOSFromSavedResponse(
  productCode: string,
  onProgress?: (message: string) => void
): Promise<boolean> {
  try {
    onProgress?.("📥 Đang lấy dữ liệu đã lưu...");
    
    // Get parent product with saved response
    const { data: product, error } = await supabase
      .from('products')
      .select('variant_tpos_response, tpos_product_id, product_name')
      .eq('product_code', productCode)
      .eq('base_product_code', productCode)
      .single();
      
    if (error || !product) {
      throw new Error('Không tìm thấy sản phẩm');
    }
    
    if (!product.variant_tpos_response) {
      throw new Error('Chưa có dữ liệu variants đã xử lý từ TPOS');
    }
    
    if (!product.tpos_product_id) {
      throw new Error('Sản phẩm chưa có ID trên TPOS');
    }
    
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
      throw new Error('Không tìm thấy TPOS token');
    }
    
    const headers = {
      'Authorization': `Bearer ${tokenData.bearer_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tpos-lang': 'vi'
    };
    
    onProgress?.("📤 Đang upload lên TPOS (bước 1/2)...");
    
    // Fetch current product data from TPOS
    const productResponse = await fetch(
      `https://tomato.tpos.vn/odata/ProductTemplate(${product.tpos_product_id})`,
      { headers }
    );
    
    if (!productResponse.ok) {
      throw new Error('Không thể lấy dữ liệu sản phẩm từ TPOS');
    }
    
    const currentProductData = await productResponse.json();
    
    // Parse saved response
    const savedResponse = product.variant_tpos_response as any;
    
    // Prepare UpdateV2 payload
    const updatePayload = {
      ...currentProductData,
      ProductVariants: savedResponse.previewVariants,
      AttributeLines: savedResponse.attributeLines,
      Version: 0
    };
    
    // Remove @odata metadata
    const cleanPayload = removeODataMetadata(updatePayload);
    
    onProgress?.("📤 Đang lưu variants (bước 2/2)...");
    
    // Call UpdateV2 API
    const updateResponse = await fetch(
      'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanPayload)
      }
    );
    
    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`TPOS API Error: ${errorData.error?.message || updateResponse.status}`);
    }
    
    onProgress?.("✅ Upload thành công!");
    return true;
    
  } catch (error: any) {
    console.error('Upload failed:', error);
    throw error;
  }
}

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
