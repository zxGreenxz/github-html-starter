import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedImageUpload } from "@/components/ui/unified-image-upload";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    product_code: string;
    product_name: string;
    variant?: string;
    prepared_quantity: number;
    live_phase_id?: string;
    live_session_id?: string;
    image_url?: string;
  } | null;
}

interface VariantData {
  id?: string;
  name: string;
  quantity: number;
}

interface FormData {
  product_code: string;
  product_name: string;
  variants: VariantData[];
}

export function EditProductDialog({ open, onOpenChange, product }: EditProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      product_code: "",
      product_name: "",
      variants: [{ name: "", quantity: 0 }],
    },
  });

  // Load all variants of the same product_code
  const { data: allVariants, isLoading } = useQuery({
    queryKey: ["product-variants", product?.product_code, product?.live_phase_id],
    queryFn: async () => {
      if (!product?.product_code || !product?.live_phase_id) return [];
      
      const { data, error } = await supabase
        .from("live_products")
        .select("id, variant, prepared_quantity, image_url")
        .eq("live_phase_id", product.live_phase_id)
        .eq("product_code", product.product_code)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!product?.product_code && !!product?.live_phase_id,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        product_code: "",
        product_name: "",
        variants: [{ name: "", quantity: 0 }],
      });
      setDuplicateWarning("");
      setImageUrl("");
    }
  }, [open, form]);

  // Reset form when variants are loaded
  useEffect(() => {
    if (product && open && allVariants) {
      const variants = allVariants.map(v => ({
        id: v.id,
        name: v.variant || "",
        quantity: v.prepared_quantity,
      }));

      form.reset({
        product_code: product.product_code,
        product_name: product.product_name,
        variants: variants.length > 0 ? variants : [{ name: "", quantity: 0 }],
      });
      setDuplicateWarning("");
      setImageUrl(allVariants[0]?.image_url || "");
    }
  }, [allVariants, product?.product_code, open, form]);

  const addVariant = () => {
    const currentVariants = form.getValues("variants");
    form.setValue("variants", [...currentVariants, { name: "", quantity: 0 }]);
  };

  const removeVariant = (index: number) => {
    const currentVariants = form.getValues("variants");
    form.setValue("variants", currentVariants.filter((_, i) => i !== index));
  };


  const updateProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!product?.live_phase_id || !product?.live_session_id) {
        throw new Error("Missing phase or session ID");
      }

      const productCode = data.product_code.trim().toUpperCase();
      const productName = data.product_name.trim().toUpperCase();
      
      // Use already uploaded image URL
      const finalImageUrl = imageUrl || undefined;
      
      // Get current variants from database
      const existingVariantIds = allVariants?.map(v => v.id) || [];
      const formVariantIds = data.variants.map(v => v.id).filter(Boolean);
      
      // 1. Delete removed variants
      const variantsToDelete = existingVariantIds.filter(id => !formVariantIds.includes(id));
      if (variantsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("live_products")
          .delete()
          .in("id", variantsToDelete);
        
        if (deleteError) throw deleteError;
      }

      // 2. Update existing variants and product info
      for (const variant of data.variants) {
        if (variant.id) {
            const { error: updateError } = await supabase
              .from("live_products")
              .update({
                product_code: productCode,
                product_name: productName,
                variant: variant.name?.trim().toUpperCase() || null,
                prepared_quantity: variant.quantity,
                image_url: finalImageUrl,
              })
              .eq("id", variant.id);
          
          if (updateError) throw updateError;
        }
      }

      // 3. Insert new variants
      const newVariants = data.variants.filter(v => !v.id);
      if (newVariants.length > 0) {
        // Check for duplicates
        for (const variant of newVariants) {
          const variantName = variant.name?.trim() || null;
          const { data: existing } = await supabase
            .from("live_products")
            .select("id")
            .eq("live_phase_id", product.live_phase_id)
            .eq("product_code", productCode)
            .eq("variant", variantName);

          if (existing && existing.length > 0) {
            throw new Error(`Biến thể "${variant.name || '(Không có)'}" đã tồn tại`);
          }
        }

        const insertData = newVariants.map(variant => ({
          live_session_id: product.live_session_id,
          live_phase_id: product.live_phase_id,
          product_code: productCode,
          product_name: productName,
          variant: variant.name?.trim().toUpperCase() || null,
          prepared_quantity: variant.quantity,
          sold_quantity: 0,
          image_url: finalImageUrl,
        }));

        const { error: insertError } = await supabase
          .from("live_products")
          .insert(insertData);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      queryClient.invalidateQueries({ queryKey: ["product-variants"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật sản phẩm và biến thể thành công",
      });
      onOpenChange(false);
      setIsSubmitting(false);
    },
    onError: (error: Error) => {
      console.error("Error updating product:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật sản phẩm. Vui lòng thử lại.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!data.product_code.trim()) {
      toast({
        title: "Lỗi",
        description: "Mã sản phẩm không được để trống",
        variant: "destructive",
      });
      return;
    }

    if (!data.product_name.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên sản phẩm không được để trống",
        variant: "destructive",
      });
      return;
    }

    // Filter out completely empty variants (no name and quantity = 0)
    // BUT always keep existing variants (those with an id)
    const validVariants = data.variants.filter(v => {
      // Keep all existing variants (those with an id)
      if (v.id) return true;
      // Only filter out new variants that are completely empty
      return v.name?.trim() || v.quantity > 0;
    });
    

    // Check for duplicate variant names in form
    const variantNames = validVariants
      .map(v => v.name?.trim().toLowerCase())
      .filter(n => n);
    const duplicates = variantNames.filter((name, index) => variantNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      toast({
        title: "Lỗi",
        description: "Có biến thể bị trùng lặp",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    // Pass only valid variants to mutation
    updateProductMutation.mutate({
      ...data,
      variants: validVariants,
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa sản phẩm và biến thể</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm và biến thể</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {duplicateWarning && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã sản phẩm</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập mã sản phẩm" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập tên sản phẩm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Hình ảnh sản phẩm</FormLabel>
              <div className="mt-2">
                <UnifiedImageUpload
                  value={imageUrl}
                  onChange={(url) => setImageUrl(typeof url === 'string' ? url : url[0] || '')}
                  bucket="purchase-images"
                  folder="live-products"
                  placeholder="Dán ảnh (Ctrl+V), kéo thả, hoặc click"
                  showPreview={true}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Danh sách biến thể</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                >
                  + Thêm biến thể
                </Button>
              </div>

              {form.watch("variants").map((variant, index) => (
                <div key={variant.id || `new-${index}`} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`variants.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel className="sr-only">Tên biến thể</FormLabel>}
                        <FormControl>
                          <Input 
                            placeholder="Tên biến thể (không bắt buộc)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`variants.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        {index === 0 && <FormLabel className="sr-only">Số lượng chuẩn bị</FormLabel>}
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            placeholder="Số lượng"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVariant(index)}
                    className="mt-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}