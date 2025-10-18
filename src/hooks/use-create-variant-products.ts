import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BaseProductData {
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  stock_quantity: number;
  product_images: string[];
  price_images: string[];
}

interface ChildVariantData {
  product_code: string;
  base_product_code: string;
  product_name: string;
  variant: string;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  product_images: string[];
  price_images: string[];
}

interface CreateVariantInput {
  baseProduct: BaseProductData;
  childVariants: ChildVariantData[];
  onSuccessCallback?: () => void;
}

export function useCreateVariantProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      const { baseProduct, childVariants } = input;

      // 1. Handle Base Product
      const { data: existingBase } = await supabase
        .from("products")
        .select("*")
        .eq("product_code", baseProduct.product_code)
        .maybeSingle();

      let baseAction: 'created' | 'updated';
      if (existingBase) {
        // UPDATE: Replace variant completely (not merge) to allow removing variants
        const { error } = await supabase
          .from("products")
          .update({
            product_images: baseProduct.product_images,
            variant: baseProduct.variant // Replace completely, not merge
          })
          .eq("product_code", baseProduct.product_code);

        if (error) throw error;
        baseAction = 'updated';
      } else {
        // INSERT with full data
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: baseProduct.product_code,
            base_product_code: baseProduct.product_code,
            product_name: baseProduct.product_name,
            variant: baseProduct.variant,
            purchase_price: baseProduct.purchase_price,
            selling_price: baseProduct.selling_price,
            supplier_name: baseProduct.supplier_name || null,
            stock_quantity: baseProduct.stock_quantity,
            unit: "Cái",
            product_images: baseProduct.product_images,
            price_images: baseProduct.price_images
          });

        if (error) throw error;
        baseAction = 'created';
      }

      // 2. Handle Child Variants
      // IMPORTANT: Delete ALL existing child variants first to regenerate with correct codes
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("base_product_code", baseProduct.product_code)
        .neq("product_code", baseProduct.product_code);

      if (deleteError) throw deleteError;

      // Insert all child variants with correct order and codes
      let childrenCreated = 0;
      if (childVariants.length > 0) {
        // Insert one by one with small delay to ensure created_at order
        for (let i = 0; i < childVariants.length; i++) {
          const c = childVariants[i];
          const { error } = await supabase
            .from("products")
            .insert({
              product_code: c.product_code,
              base_product_code: c.base_product_code,
              product_name: c.product_name,
              variant: c.variant,
              purchase_price: c.purchase_price,
              selling_price: c.selling_price,
              supplier_name: c.supplier_name || null,
              stock_quantity: 0,
              unit: "Cái",
              product_images: c.product_images,
              price_images: c.price_images
            });

          if (error) throw error;
          childrenCreated++;
          
          // Small delay to ensure different created_at timestamps
          if (i < childVariants.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }

      return { 
        baseAction, 
        baseProduct: baseProduct.product_code,
        childrenCreated
      };
    },
    onSuccess: ({ baseAction, baseProduct, childrenCreated }, variables) => {
      const baseActionText = baseAction === 'created' ? 'tạo' : 'cập nhật';
      const messages = [`Đã ${baseActionText} sản phẩm gốc: ${baseProduct}`];
      
      if (childrenCreated > 0) {
        messages.push(`Đã tạo ${childrenCreated} biến thể mới`);
      }

      toast({
        title: "Tạo biến thể thành công",
        description: messages.join(' • ')
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
      
      // Gọi callback nếu có
      if (variables.onSuccessCallback) {
        variables.onSuccessCallback();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi xử lý sản phẩm",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
