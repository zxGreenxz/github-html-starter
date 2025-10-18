import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch all product variants for a given product code
 * Returns array of product codes including all variants
 * Logic mirrors LiveProducts.tsx barcode scanning
 */
export async function fetchProductVariants(productCode: string): Promise<string[]> {
  try {
    // 1. Find the scanned product
    const { data: scannedProduct, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("product_code", productCode.trim())
      .maybeSingle();
    
    if (productError) throw productError;
    if (!scannedProduct) return [productCode]; // Return original if not found
    
    let productsToAdd = [];
    
    // 2. Check if product name has "-"
    if (scannedProduct.product_name.includes('-')) {
      // CASE 1: Name has "-" → Split and search by name
      // Prioritize split by ' - ' (with space), fallback to '-' if not found
      const baseNamePrefix = scannedProduct.product_name.includes(' - ')
        ? scannedProduct.product_name.split(' - ')[0].trim()
        : scannedProduct.product_name.split('-')[0].trim();
      
      const { data: matchingProducts, error: matchError } = await supabase
        .from("products")
        .select("*")
        .ilike("product_name", `${baseNamePrefix}%`);
      
      if (matchError) throw matchError;
      productsToAdd = matchingProducts || [];
    } else {
      // CASE 2: No "-" → Use base_product_code
      const baseCode = scannedProduct.base_product_code || scannedProduct.product_code;
      
      // Get ALL variants (including base product if it has variants)
      const { data: variants, error: variantsError } = await supabase
        .from("products")
        .select("*")
        .eq("base_product_code", baseCode)
        .not("variant", "is", null)
        .neq("variant", "");
      
      if (variantsError) throw variantsError;
      
      // If variants found, include base product + all variants
      if (variants && variants.length > 0) {
        // Add base product first, then variants
        productsToAdd = [scannedProduct, ...variants.filter(v => v.product_code !== scannedProduct.product_code)];
      } else {
        // No variants - just use the scanned product
        productsToAdd = [scannedProduct];
      }
    }
    
    if (productsToAdd.length === 0) {
      return [productCode]; // Return original if nothing found
    }
    
    // Return array of product codes
    return productsToAdd.map(p => p.product_code);
  } catch (error) {
    console.error('Error fetching product variants:', error);
    return [productCode]; // Return original on error
  }
}

/**
 * Fetch full product details for multiple product codes
 * Returns array of product objects with all details
 */
export async function fetchProductsByCode(productCodes: string[]): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("product_code", productCodes);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching products by code:', error);
    return [];
  }
}
