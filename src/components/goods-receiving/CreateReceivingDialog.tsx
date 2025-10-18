import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Package, AlertCircle, CheckCircle } from "lucide-react";
import { ReceivingItemRow } from "./ReceivingItemRow";
import { useIsMobile } from "@/hooks/use-mobile";

interface CreateReceivingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

export function CreateReceivingDialog({ open, onOpenChange, order, onSuccess }: CreateReceivingDialogProps) {
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedItems, setConfirmedItems] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && order) {
      setItems(order.items?.map((item: any) => ({
        ...item,
        product_name: item.product?.product_name,
        product_code: item.product?.product_code,
        variant: item.product?.variant,
        product_images: item.product?.product_images,
        received_quantity: item.quantity,
        item_notes: ""
      })) || []);
      setNotes("");
      setConfirmedItems(new Set());
    }
  }, [open, order]);

  const calculateDiscrepancy = (expected: number, received: number) => {
    const diff = received - expected;
    
    return {
      quantity: diff,
      type: diff < 0 ? 'shortage' : (diff > 0 ? 'overage' : 'match'),
      className: diff < 0 ? 'bg-red-50 text-red-700' : 
                 (diff > 0 ? 'bg-green-50 text-green-700' : ''),
      icon: diff < 0 ? AlertCircle : (diff > 0 ? CheckCircle : null),
      label: diff < 0 ? `Thiếu ${Math.abs(diff)}` : 
             (diff > 0 ? `Dư ${diff}` : 'Đủ')
    };
  };

  const handleQuantityChange = (itemId: string, receivedQty: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, received_quantity: receivedQty }
        : item
    ));
    // Unconfirm item when quantity changes
    setConfirmedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  };

  const handleConfirm = (itemId: string) => {
    setConfirmedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thực hiện kiểm hàng");
      return;
    }

    // Get username from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      toast.error("Không tìm thấy thông tin người dùng");
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate totals
      const totalExpected = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);
      const hasDiscrepancy = items.some(item => item.quantity !== item.received_quantity);

      // 1. Insert goods_receiving
      const { data: receiving, error: receivingError } = await supabase
        .from('goods_receiving')
        .insert({
          purchase_order_id: order.id,
          received_by_user_id: user.id,
          received_by_username: profile.username,
          total_items_expected: totalExpected,
          total_items_received: totalReceived,
          has_discrepancy: hasDiscrepancy,
          notes: notes
        })
        .select()
        .single();

      if (receivingError) throw receivingError;

      // 2. Insert goods_receiving_items
      const itemsToInsert = items.map(item => {
        const discrepancy = calculateDiscrepancy(item.quantity, item.received_quantity);
        
        return {
          goods_receiving_id: receiving.id,
          purchase_order_item_id: item.id,
          product_name: item.product_name,
          product_code: item.product_code,
          variant: item.variant,
          expected_quantity: item.quantity,
          received_quantity: item.received_quantity,
          discrepancy_type: discrepancy.type,
          discrepancy_quantity: discrepancy.quantity,
          product_condition: 'good',
          item_notes: item.item_notes
        };
      });

      const { error: itemsError } = await supabase
        .from('goods_receiving_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Update purchase_order status
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['goods-receiving-orders'] });
      queryClient.invalidateQueries({ queryKey: ['goods-receiving-stats'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });

      toast.success("Kiểm hàng thành công!");
      onSuccess();

    } catch (error: any) {
      console.error('Error submitting receiving:', error);
      toast.error(error.message || "Có lỗi xảy ra khi kiểm hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  const totalExpected = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);
  const allItemsConfirmed = items.length > 0 && confirmedItems.size === items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? "w-full h-screen max-w-full p-0 flex flex-col" : "max-w-4xl max-h-[90vh]"}>
        <DialogHeader className={isMobile ? "p-4 pb-0" : ""}>
          <DialogTitle className="flex items-center gap-2">
            <Package className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
            Kiểm hàng chi tiết
          </DialogTitle>
          <DialogDescription>
            Nhập số lượng thực nhận cho từng sản phẩm
          </DialogDescription>
        </DialogHeader>

        {/* Sticky Summary Bar */}
        <div className={`bg-muted/50 ${isMobile ? 'sticky top-0 z-10 shadow-md' : 'rounded-lg'} p-3 ${isMobile ? 'mx-4' : 'mx-6'} ${isMobile ? 'grid grid-cols-3 gap-2' : 'flex justify-between items-center'}`}>
          <div className={isMobile ? "text-center" : "text-sm"}>
            <div className={isMobile ? "text-xs text-muted-foreground" : "inline"}>
              <span className="text-muted-foreground">Tổng đặt:</span>
            </div>
            <div className={isMobile ? "text-lg font-bold" : "inline font-medium ml-2"}>
              {totalExpected}
            </div>
          </div>
          <div className={isMobile ? "text-center" : "text-sm"}>
            <div className={isMobile ? "text-xs text-muted-foreground" : "inline"}>
              <span className="text-muted-foreground">Tổng nhận:</span>
            </div>
            <div className={isMobile ? "text-lg font-bold" : "inline font-medium ml-2"}>
              {totalReceived}
            </div>
          </div>
          <div className={isMobile ? "text-center" : "text-sm"}>
            <div className={isMobile ? "text-xs text-muted-foreground" : "inline"}>
              <span className="text-muted-foreground">Đã xác nhận:</span>
            </div>
            <div className={`${isMobile ? "text-lg font-bold" : "inline font-medium ml-2"} ${
              allItemsConfirmed ? 'text-green-600' : 'text-orange-600'
            }`}>
              {confirmedItems.size}/{items.length}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className={`space-y-4 ${isMobile ? 'flex-1 overflow-y-auto px-4 pb-4' : 'px-6 flex-1 overflow-y-auto'}`}>
          {/* Items - Mobile: Cards, Desktop: Table */}
          {isMobile ? (
            <div className="space-y-3">
              {items.map((item, index) => (
                <ReceivingItemRow
                  key={item.id}
                  item={item}
                  isConfirmed={confirmedItems.has(item.id)}
                  onQuantityChange={handleQuantityChange}
                  onConfirm={handleConfirm}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">STT</TableHead>
                    <TableHead className="min-w-[200px]">Sản phẩm</TableHead>
                    <TableHead className="text-center w-20">SL đặt</TableHead>
                    <TableHead className="text-center w-28">SL nhận</TableHead>
                    <TableHead className="text-center w-32">Chênh lệch</TableHead>
                    <TableHead className="text-center w-32">Xác nhận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <ReceivingItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      isConfirmed={confirmedItems.has(item.id)}
                      onQuantityChange={handleQuantityChange}
                      onConfirm={handleConfirm}
                      isMobile={isMobile}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Nhập ghi chú về quá trình kiểm hàng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={isMobile ? 'text-base' : ''}
            />
          </div>

          {/* Action buttons - Inside scroll container, at the bottom (Mobile only) */}
          {isMobile && (
            <div className="flex flex-col-reverse gap-2 mt-6 pt-4 border-t pb-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] text-base"
              >
                Hủy
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !allItemsConfirmed}
                title={!allItemsConfirmed ? "Vui lòng xác nhận tất cả sản phẩm trước khi hoàn thành" : ""}
                className="w-full min-h-[48px] text-base"
              >
                {isSubmitting ? "Đang xử lý..." : "Hoàn thành kiểm hàng"}
              </Button>
            </div>
          )}
        </div>

        {/* Action buttons - Desktop only (outside scroll container) */}
        {!isMobile && (
          <div className="flex justify-end px-6 pb-6 gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !allItemsConfirmed}
              title={!allItemsConfirmed ? "Vui lòng xác nhận tất cả sản phẩm trước khi hoàn thành" : ""}
            >
              {isSubmitting ? "Đang xử lý..." : "Hoàn thành kiểm hàng"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
