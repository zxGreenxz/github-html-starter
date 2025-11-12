import { supabase } from "@/integrations/supabase/client";

// DELETED: fetchAndSaveTPOSImage() was faulty - it relied on getProductDetail() 
// which queried TPOS incorrectly for variants, causing wrong images to be saved.
// Images should be manually uploaded via product_images or synced correctly from TPOS.

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
