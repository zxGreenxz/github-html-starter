import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

const formSchema = z.object({
  quantity: z.coerce.number().min(0, "Số lượng không được âm"),
  note: z.string().optional(),
});

interface EditOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItem: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    note?: string | null;
    facebook_comment_id?: string | null;
  } | null;
  phaseId: string;
}

export function EditOrderItemDialog({
  open,
  onOpenChange,
  orderItem,
  phaseId,
}: EditOrderItemDialogProps) {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  // Fetch comment info from facebook_pending_orders
  const { data: pendingOrderInfo } = useQuery({
    queryKey: ['facebook-pending-order-info', orderItem?.facebook_comment_id],
    queryFn: async () => {
      const commentId = orderItem?.facebook_comment_id;
      if (!commentId) return null;
      
      const { data } = await supabase
        .from('facebook_pending_orders')
        .select('session_index, name, comment, created_time')
        .eq('facebook_comment_id', commentId)
        .maybeSingle();
      
      return data || null;
    },
    enabled: !!orderItem?.facebook_comment_id,
  });

  // Fetch phase data to get phase_date for invalidating facebook_pending_orders query
  const { data: phaseData } = useQuery({
    queryKey: ['live-phase', phaseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_phases')
        .select('phase_date')
        .eq('id', phaseId)
        .single();
      
      return data;
    },
    enabled: !!phaseId && phaseId !== 'all',
  });

  useEffect(() => {
    if (orderItem) {
      form.reset({
        quantity: orderItem.quantity,
        note: orderItem.note || '',
      });
    }
  }, [orderItem, form]);

  const updateOrderItemMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!orderItem) return;

      console.log('[EditOrder] Starting mutation with values:', values);
      console.log('[EditOrder] OrderItem:', orderItem);

      // If quantity is 0, DELETE the order immediately (regardless of what it was before)
      if (values.quantity === 0) {
        console.log('[EditOrder] Quantity is 0, deleting order...');
        
        // Delete the order
        const { error: deleteError } = await supabase
          .from('live_orders')
          .delete()
          .eq('id', orderItem.id);

        if (deleteError) throw deleteError;

        // Update sold_quantity in live_products (subtract the old quantity)
        const { data: product } = await supabase
          .from('live_products')
          .select('sold_quantity')
          .eq('id', orderItem.product_id)
          .single();
        
        if (product) {
          const newSoldQty = Math.max(0, product.sold_quantity - orderItem.quantity);
          await supabase
            .from('live_products')
            .update({ sold_quantity: newSoldQty })
            .eq('id', orderItem.product_id);
        }

        console.log('[EditOrder] Order deleted successfully');
        return { deleted: true };
      }

      // Check if anything changed (only for quantity > 0)
      const quantityDiff = values.quantity - orderItem.quantity;
      const currentNote = orderItem.note || '';
      const newNote = values.note || '';
      const noteChanged = currentNote !== newNote;

      console.log('[EditOrder] quantityDiff:', quantityDiff, 'noteChanged:', noteChanged);

      // Return early if nothing changed
      if (quantityDiff === 0 && !noteChanged) {
        console.log('[EditOrder] No changes detected, closing dialog');
        onOpenChange(false);
        return;
      }

      // Update order quantity, note and reset upload status
      const { error: orderError } = await supabase
        .from('live_orders')
        .update({ 
          quantity: values.quantity,
          note: values.note || null,
          upload_status: null,
          uploaded_at: null,
          tpos_order_id: null,
          code_tpos_order_id: null
        })
        .eq('id', orderItem.id);

      if (orderError) throw orderError;

      // Update sold_quantity in live_products if quantity changed
      if (quantityDiff !== 0) {
        const { data: product } = await supabase
          .from('live_products')
          .select('sold_quantity')
          .eq('id', orderItem.product_id)
          .single();
        
        if (product) {
          const newSoldQty = Math.max(0, product.sold_quantity + quantityDiff);
          await supabase
            .from('live_products')
            .update({ sold_quantity: newSoldQty })
            .eq('id', orderItem.product_id);
        }
      }

      return { deleted: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", phaseId] });
      
      // Invalidate facebook_pending_orders to refresh Quick Add Order
      if (phaseData?.phase_date) {
        queryClient.invalidateQueries({ queryKey: ["facebook-pending-orders", phaseData.phase_date] });
      }
      
      // Show appropriate message based on action
      if (result?.deleted) {
        toast.success("Đã xóa sản phẩm khỏi đơn hàng");
      } else {
        toast.success("Đã cập nhật sản phẩm thành công");
      }
      
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error updating order item:", error);
      toast.error("Có lỗi xảy ra khi cập nhật số lượng");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log('[EditOrder] onSubmit called with:', values);
    updateOrderItemMutation.mutate(values);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa số lượng sản phẩm</DialogTitle>
            <DialogDescription>
              Cập nhật số lượng cho sản phẩm: <strong>{orderItem?.product_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số lượng</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Nhập số lượng"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ghi chú</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập ghi chú cho sản phẩm này (tùy chọn)" 
                        {...field} 
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {orderItem?.facebook_comment_id && pendingOrderInfo && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                  <div className="text-sm font-medium">Thông tin từ Facebook:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Mã:</span>
                      <span className="ml-2 font-mono">{pendingOrderInfo.session_index}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tên:</span>
                      <span className="ml-2">{pendingOrderInfo.name}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Comment:</span>
                      <p className="ml-2 text-xs">{pendingOrderInfo.comment}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Thời gian:</span>
                      <span className="ml-2 text-xs">
                        {format(new Date(pendingOrderInfo.created_time), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateOrderItemMutation.isPending}
                >
                  {updateOrderItemMutation.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}