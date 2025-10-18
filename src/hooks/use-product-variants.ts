import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductVariant {
  id: string;
  product_code: string;
  product_name: string;
  variant: string;
  product_images: string[] | null;
  tpos_image_url: string | null;
  stock_quantity: number;
  base_product_code: string | null;
}

export function useProductVariants(baseProductCode: string) {
  return useQuery({
    queryKey: ["product-variants", baseProductCode],
    queryFn: async () => {
      if (!baseProductCode || baseProductCode.trim().length === 0) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, product_name, variant, product_images, tpos_image_url, stock_quantity, base_product_code")
        .eq("base_product_code", baseProductCode)
        .not("variant", "is", null)
        .neq("variant", "")
        .neq("product_code", baseProductCode)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data || []) as ProductVariant[];
    },
    enabled: baseProductCode.trim().length > 0
  });
}
