import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Building2, FileText, DollarSign, Package, AlertCircle, RefreshCw, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/currency-utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  supplier_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  // Primary fields (renamed from snapshot)
  product_code: string;
  product_name: string;
  variant?: string | null;
  purchase_price: number;
  selling_price: number;
  product_images?: string[];
  price_images?: string[];
  // TPOS sync tracking
  tpos_sync_status?: string;
  tpos_sync_error?: string | null;
}

interface PurchaseOrderDetailDialogProps {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailDialog({ order, open, onOpenChange }: PurchaseOrderDetailDialogProps) {
  if (!order) return null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  // Fetch purchase order items (no JOIN needed - all data is in purchase_order_items)
  const { data: orderItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['purchaseOrderItems', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', order.id)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
    enabled: open && !!order.id
  });

  // Calculate totals from items for verification
  const itemsTotalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotalAmount = orderItems.reduce((sum, item) => {
    const price = item.purchase_price || 0;
    return sum + (item.quantity * price);
  }, 0);

  // Count failed items
  const failedItems = orderItems.filter(item => item.tpos_sync_status === 'failed');
  const failedCount = failedItems.length;

  // Retry failed items handler
  const handleRetryFailed = async () => {
    setIsRetrying(true);

    try {
      // Reset status to 'pending' for failed items
      const { error: resetError } = await supabase
        .from('purchase_order_items')
        .update({ 
          tpos_sync_status: 'pending', 
          tpos_sync_error: null 
        })
        .eq('purchase_order_id', order.id)
        .eq('tpos_sync_status', 'failed');

      if (resetError) {
        throw resetError;
      }

      // Invoke background processing again
      const { error: invokeError } = await supabase.functions.invoke(
        'process-purchase-order-background',
        { body: { purchase_order_id: order.id } }
      );

      if (invokeError) {
        throw invokeError;
      }

      toast({
        title: "Đang retry",
        description: `Đang retry ${failedCount} sản phẩm lỗi...`,
        duration: 5000,
      });

      // Refresh items
      queryClient.invalidateQueries({ queryKey: ['purchaseOrderItems', order.id] });
      
      // Close dialog to let user see toast progress
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể retry. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "secondary", 
      received: "default",
      completed: "default",
      cancelled: "destructive"
    };

    const labels = {
      pending: "Đang chờ",
      confirmed: "Đã xác nhận", 
      received: "Đã nhận hàng",
      completed: "Hoàn thành",
      cancelled: "Đã hủy"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chi tiết đơn hàng #{order.id.slice(-8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Nhà cung cấp</span>
              </div>
              <p className="text-base">{order.supplier_name || "Chưa cập nhật"}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Trạng thái</span>
              </div>
              <div>{getStatusBadge(order.status)}</div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ngày đặt hàng</span>
              </div>
              <p className="text-base">
                {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Product Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Chi tiết sản phẩm</span>
              {itemsTotalQuantity > 0 && (
                <Badge variant="secondary">{itemsTotalQuantity} sản phẩm</Badge>
              )}
            </div>
            
            {itemsLoading ? (
              <div className="text-center py-4 text-muted-foreground">Đang tải...</div>
            ) : orderItems.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Hình ảnh</TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead className="text-center">Số lượng</TableHead>
                        <TableHead className="text-right">Đơn giá (VND)</TableHead>
                        <TableHead className="text-right">Thành tiền (VND)</TableHead>
                      </TableRow>
                    </TableHeader>
                   <TableBody>
                     {orderItems.map((item) => {
                       const productName = item.product_name || "Sản phẩm đã xóa";
                       const productImages = item.product_images || [];
                       const purchasePrice = item.purchase_price || 0;
                       
                       return (
                       <TableRow key={item.id}>
                         <TableCell>
                           {productImages && productImages.length > 0 ? (
                             <div className="flex flex-wrap gap-1">
                               {productImages.slice(0, 2).map((imageUrl, index) => (
                                 <img
                                   key={index}
                                   src={imageUrl}
                                   alt={`${productName} ${index + 1}`}
                                   className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-75 transition-opacity"
                                   onClick={() => window.open(imageUrl, '_blank')}
                                 />
                               ))}
                               {productImages.length > 2 && (
                                 <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                                   +{productImages.length - 2}
                                 </div>
                               )}
                             </div>
                           ) : (
                             <div className="text-xs text-muted-foreground">Không có</div>
                           )}
                         </TableCell>
                         <TableCell>
                           <div className="space-y-1">
                             <div className="font-medium">{productName}</div>
                             {item.notes && (
                               <div className="text-xs text-muted-foreground italic">
                                 Ghi chú: {item.notes}
                               </div>
                             )}
                           </div>
                         </TableCell>
                         <TableCell className="text-center font-medium">
                           {item.quantity}
                         </TableCell>
                         <TableCell className="text-right">
                           {formatVND(purchasePrice)}
                         </TableCell>
                         <TableCell className="text-right font-medium">
                           {formatVND(purchasePrice * item.quantity)}
                         </TableCell>
                       </TableRow>
                       );
                     })}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có sản phẩm nào trong đơn hàng này
              </div>
            )}
            
            {/* Items Summary */}
            {orderItems.length > 0 && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Tổng từ chi tiết sản phẩm:</span>
                  <span className="font-medium">{formatVND(itemsTotalAmount)}</span>
                </div>
                {Math.abs(itemsTotalAmount - (order.total_amount || 0)) > 0.01 && (
                  <div className="text-xs text-destructive mt-1">
                    ⚠️ Có chênh lệch với tổng tiền đơn hàng
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Failed Items Section */}
          {failedCount > 0 && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">Sản phẩm lỗi ({failedCount})</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleRetryFailed}
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang retry...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Failed Items
                      </>
                    )}
                  </Button>
                </div>
                
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-4 space-y-2">
                    {failedItems.map(item => (
                      <div key={item.id} className="flex items-start gap-2 p-2 bg-destructive/10 rounded">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.product_code}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.product_name}</div>
                          {item.tpos_sync_error && (
                            <div className="text-xs text-destructive mt-1">
                              Lỗi: {item.tpos_sync_error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />
            </>
          )}

            <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Thông tin tài chính (VND)</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span>Tổng tiền:</span>
                <span className="font-medium">{formatVND(order.total_amount || 0)}</span>
              </div>
              
              {(order.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Giảm giá:</span>
                  <span className="font-medium">-{formatVND(order.discount_amount || 0)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-semibold">
                <span>Thành tiền:</span>
                <span className="text-primary">{formatVND(order.final_amount || 0)}</span>
              </div>
            </div>
          </div>

            {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <p className="text-base bg-muted/50 p-3 rounded whitespace-pre-wrap">
                  {order.notes}
                </p>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Tạo lúc:</span>
              <p>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
            </div>
            <div>
              <span className="font-medium">Cập nhật:</span>
              <p>{format(new Date(order.updated_at), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
