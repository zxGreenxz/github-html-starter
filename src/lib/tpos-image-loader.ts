import { supabase } from "@/integrations/supabase/client";
import { getProductDetail } from "./tpos-api";

/**
 * Fetch TPOS image URL for a product and save it to the database
 * Only called once per product, then cached in database
 */
export async function fetchAndSaveTPOSImage(
  productId: string,
  productCode: string,
  tposProductId?: number | null
): Promise<string | null> {
  try {
    // If no TPOS product ID, can't fetch
    if (!tposProductId) {
      console.log(`No TPOS product ID for ${productCode}`);
      return null;
    }

    console.log(`Fetching TPOS image for product ${productCode} (TPOS ID: ${tposProductId})`);
    
    // Fetch product detail from TPOS
    const tposProduct = await getProductDetail(tposProductId);
    
    if (!tposProduct) {
      console.log(`No TPOS product found for ID ${tposProductId}`);
      return null;
    }

    // Extract ImgUrl from TPOS response
    const imgUrl = tposProduct.ImgUrl || tposProduct.ImageUrl || tposProduct.Image;
    
    // Add browser cache hint for faster subsequent loads
    if (imgUrl) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = imgUrl;
      document.head.appendChild(link);
    }
    
    if (!imgUrl) {
      console.log(`No image URL in TPOS response for ${productCode}`);
      return null;
    }

    // Save to database
    const { error } = await supabase
      .from("products")
      .update({ tpos_image_url: imgUrl })
      .eq("id", productId);

    if (error) {
      console.error("Error saving TPOS image URL:", error);
      return null;
    }

    console.log(`Saved TPOS image URL for ${productCode}`);
    return imgUrl;
  } catch (error) {
    console.error("Error fetching TPOS image:", error);
    return null;
  }
}

/**
 * Get parent product's tpos_image_url if this is a child product
 * Returns null if not a child or parent has no image
 */
export async function getParentImageUrl(
  productCode: string,
  baseProductCode: string | null | undefined
): Promise<string | null> {
  // Not a child product (base_product_code == product_code or null)
  if (!baseProductCode || baseProductCode === productCode) {
    return null;
  }

  // Fetch parent product
  const { data: parentProduct, error } = await supabase
    .from("products")
    .select("tpos_image_url")
    .eq("product_code", baseProductCode)
    .maybeSingle();

  if (error) {
    console.error("Error fetching parent image:", error);
    return null;
  }

  return parentProduct?.tpos_image_url || null;
}

/**
 * Get the display image URL for a product with priority:
 * 1. product_images[0] from Supabase (persistent)
 * 2. tpos_image_url from database (cached from TPOS)
 * 3. Parent's tpos_image_url (if this is a child product)
 * 4. Fetch from TPOS if needed (one-time)
 */
export function getProductImageUrl(
  productImages: string[] | null,
  tposImageUrl: string | null,
  parentImageUrl?: string | null
): string | null {
  // Priority 1: Use Supabase product images
  if (productImages && productImages.length > 0) {
    return productImages[0];
  }

  // Priority 2: Use cached TPOS image URL
  if (tposImageUrl) {
    return tposImageUrl;
  }

  // Priority 3: Use parent's TPOS image URL (if provided)
  if (parentImageUrl) {
    return parentImageUrl;
  }

  // Priority 4: Will be handled by component (fetch from TPOS)
  return null;
}
