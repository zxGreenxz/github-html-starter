import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  imageUrlToBase64, 
  detectAttributesFromText, 
  createAttributeLines,
  createProductDirectly,
  type TPOSProductItem
} from "@/lib/tpos-api";

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

      // 2. Handle Child Variants - Upload to TPOS first, then save to DB
      console.log(`📤 Uploading ${childVariants.length} variants to TPOS...`);

      const tposResults: Array<{
        variantIndex: number;
        variantData: ChildVariantData;
        tposProductId: number | null;
        error?: string;
      }> = [];

      // 2A. Upload each variant to TPOS
      for (let i = 0; i < childVariants.length; i++) {
        const variant = childVariants[i];
        
        try {
          // Convert image to Base64 (if exists)
          let imageBase64: string | null = null;
          if (variant.product_images?.[0]) {
            imageBase64 = await imageUrlToBase64(variant.product_images[0]);
          }
          
          // Detect attributes from variant text
          const detected = detectAttributesFromText(variant.variant || '');
          const attributeLines = createAttributeLines(detected);
          
          // Create TPOSProductItem format
          const tposItem: TPOSProductItem = {
            id: '',
            product_code: variant.product_code,
            base_product_code: variant.base_product_code,
            product_name: variant.product_name,
            variant: variant.variant,
            unit_price: variant.purchase_price,
            selling_price: variant.selling_price,
            product_images: variant.product_images,
            price_images: variant.price_images,
            supplier_name: variant.supplier_name || '',
            quantity: 1,
            purchase_order_id: ''
          };
          
          // Upload to TPOS using createProductDirectly()
          const createdProduct = await createProductDirectly(
            tposItem, 
            imageBase64, 
            attributeLines
          );
          
          console.log(`✅ Uploaded variant ${i + 1}/${childVariants.length}: ${createdProduct.Id} - ${createdProduct.Name}`);
          
          tposResults.push({
            variantIndex: i,
            variantData: variant,
            tposProductId: createdProduct.Id,
          });
          
          // Delay between requests
          if (i < childVariants.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (error) {
          console.error(`❌ Failed to upload variant ${i + 1}:`, error);
          
          tposResults.push({
            variantIndex: i,
            variantData: variant,
            tposProductId: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // 2B. Delete old child variants from DB
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("base_product_code", baseProduct.product_code)
        .neq("product_code", baseProduct.product_code);

      if (deleteError) throw deleteError;

      // 2C. Save variants to DB with tpos_product_id
      let childrenCreated = 0;
      for (const result of tposResults) {
        const variant = result.variantData;
        
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: variant.product_code,
            base_product_code: variant.base_product_code,
            product_name: variant.product_name,
            variant: variant.variant,
            purchase_price: variant.purchase_price,
            selling_price: variant.selling_price,
            supplier_name: variant.supplier_name || null,
            stock_quantity: 0,
            unit: "Cái",
            product_images: variant.product_images,
            price_images: variant.price_images,
            tpos_product_id: result.tposProductId // ⭐ Save TPOS ID
          });

        if (error) throw error;
        childrenCreated++;
        
        // Small delay
        if (result.variantIndex < tposResults.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      return { 
        baseAction, 
        baseProduct: baseProduct.product_code,
        childrenCreated,
        tposUploadSuccess: tposResults.filter(r => r.tposProductId !== null).length,
        tposUploadFailed: tposResults.filter(r => r.tposProductId === null).length
      };
    },
    onSuccess: ({ baseAction, baseProduct, childrenCreated, tposUploadSuccess, tposUploadFailed }, variables) => {
      const baseActionText = baseAction === 'created' ? 'tạo' : 'cập nhật';
      const messages = [
        `Đã ${baseActionText} sản phẩm gốc: ${baseProduct}`,
        `Đã tạo ${childrenCreated} biến thể`
      ];
      
      if (tposUploadSuccess > 0) {
        messages.push(`✅ Upload TPOS: ${tposUploadSuccess} thành công`);
      }
      
      if (tposUploadFailed > 0) {
        messages.push(`⚠️ Upload TPOS: ${tposUploadFailed} thất bại`);
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
