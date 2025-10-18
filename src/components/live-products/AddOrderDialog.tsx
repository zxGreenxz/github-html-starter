import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  productId: string;
  onOrderAdded?: (quantity: number) => void;
}

interface FormData {
  session_index: number;
  customer_code: string;
  quantity: number;
}

export function AddOrderDialog({ open, onOpenChange, sessionId, productId, onOrderAdded }: AddOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      session_index: 1,
      customer_code: "",
      quantity: 1,
    },
  });

  const addOrderMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Add the order
      const { error: orderError } = await supabase
        .from("live_orders")
        .insert([{
          live_session_id: sessionId,
          live_product_id: productId,
          session_index: data.session_index,
          customer_code: data.customer_code.trim(),
          quantity: data.quantity,
          order_date: new Date().toISOString(),
        }]);
      
      if (orderError) throw orderError;

      // Update sold quantity for the product
      const { data: currentProduct, error: fetchError } = await supabase
        .from("live_products")
        .select("sold_quantity")
        .eq("id", productId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("live_products")
        .update({
          sold_quantity: currentProduct.sold_quantity + data.quantity
        })
        .eq("id", productId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", sessionId] });
      toast.success("Đã thêm đơn hàng thành công");
      
      // Notify parent component to increment order quantity
      onOrderAdded?.(form.getValues().quantity);
      
      form.reset({
        session_index: 1,
        customer_code: "",
        quantity: 1,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error adding order:", error);
      toast.error("Có lỗi xảy ra khi thêm đơn hàng");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!sessionId || !productId) {
      toast.error("Thông tin phiên và sản phẩm không hợp lệ");
      return;
    }

    if (data.session_index <= 0 || !data.customer_code.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin đơn hàng");
      return;
    }

    if (data.quantity <= 0) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await addOrderMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Đơn Hàng</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="session_index"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số thứ tự đơn (SessionIndex) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="1"
                      placeholder="Nhập số thứ tự đơn"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã khách hàng *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập mã khách hàng"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="1"
                      placeholder="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !sessionId || !productId}
                className="flex-1"
              >
                {isSubmitting ? "Đang thêm..." : "Thêm đơn hàng"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}