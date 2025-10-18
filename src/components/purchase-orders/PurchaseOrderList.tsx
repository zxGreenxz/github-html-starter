import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Pencil, Search, Filter, Calendar, Trash2, Check, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EditPurchaseOrderDialog } from "./EditPurchaseOrderDialog";
import { useToast } from "@/hooks/use-toast";
import { formatVND } from "@/lib/currency-utils";
import { generateTPOSProductLink } from "@/lib/tpos-api";

interface PurchaseOrderItem {
  id?: string;
  product_id: string | null;
  quantity: number;
  position?: number;
  notes?: string | null;
  tpos_product_id?: number | null;
  tpos_deleted?: boolean;
  tpos_deleted_at?: string | null;
  product?: {
    product_name: string;
    product_code: string;
    variant: string | null;
    purchase_price: number;
    selling_price: number;
    product_images: string[] | null;
    price_images: string[] | null;
    base_product_code: string | null;
  };
  // Snapshot fields
  product_code_snapshot?: string;
  product_name_snapshot?: string;
  variant_snapshot?: string;
  purchase_price_snapshot?: number;
  selling_price_snapshot?: number;
  product_images_snapshot?: string[];
  price_images_snapshot?: string[];
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  shipping_fee: number;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_id?: string | null;
  notes: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
  hasShortage?: boolean;
  hasDeletedProduct?: boolean;
}

interface PurchaseOrderListProps {
  filteredOrders: PurchaseOrder[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  dateFrom: Date | undefined;
  setDateFrom: (date: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (date: Date | undefined) => void;
  quickFilter: string;
  applyQuickFilter: (type: string) => void;
  selectedOrders: string[];
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  deletedTPOSIds: Set<number>;
}

export function PurchaseOrderList({
  filteredOrders,
  isLoading,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  quickFilter,
  applyQuickFilter,
  selectedOrders,
  onToggleSelect,
  onToggleSelectAll,
  deletedTPOSIds
}: PurchaseOrderListProps) {
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletePurchaseOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Step 1: Get all purchase_order_item IDs
      const { data: itemIds } = await supabase
        .from("purchase_order_items")
        .select("id")
        .eq("purchase_order_id", orderId);

      if (itemIds && itemIds.length > 0) {
        const itemIdList = itemIds.map(item => item.id);
        
        // Step 2: Delete goods_receiving_items first
        const { error: receivingItemsError } = await supabase
          .from("goods_receiving_items")
          .delete()
          .in("purchase_order_item_id", itemIdList);

        if (receivingItemsError) throw receivingItemsError;
      }

      // Step 3: Delete goods_receiving records
      const { error: receivingError } = await supabase
        .from("goods_receiving")
        .delete()
        .eq("purchase_order_id", orderId);

      if (receivingError) throw receivingError;

      // Step 4: Delete purchase_order_items
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", orderId);

      if (itemsError) throw itemsError;

      // Step 5: Delete purchase_order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: "Thành công",
        description: "Đơn hàng đã được xóa thành công",
      });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
      console.error("Error deleting purchase order:", error);
    }
  });

  // Flatten items for rowSpan structure
  const flattenedItems = filteredOrders?.flatMap(order => {
    if (!order.items || order.items.length === 0) {
      return [{
        ...order,
        item: null,
        itemCount: 1,
        isFirstItem: true
      }];
    }
    return order.items.map((item, index) => ({
      ...order,
      item,
      itemCount: order.items.length,
      isFirstItem: index === 0
    }));
  }) || [];

  const getStatusBadge = (status: string, hasShortage?: boolean) => {
    // Prioritize showing "Giao thiếu hàng" if received with shortage
    if (status === "received" && hasShortage) {
      return <Badge variant="destructive">Giao thiếu hàng</Badge>;
    }
    
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Chờ Hàng</Badge>;
      case "received":
        return <Badge variant="default">Đã Nhận Hàng</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOldStatusBadge = (status: string) => {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setIsEditDialogOpen(true);
  };

  const handleDeleteOrder = (order: PurchaseOrder) => {
    setOrderToDelete(order);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deletePurchaseOrderMutation.mutate(orderToDelete.id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Row 1: Date Range Filters + Quick Filter */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Từ ngày */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Từ ngày:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Chọn ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Đến ngày */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Đến ngày:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Chọn ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Lọc nhanh */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Lọc nhanh:</label>
            <Select value={quickFilter} onValueChange={applyQuickFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Chọn thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="yesterday">Hôm qua</SelectItem>
                <SelectItem value="7days">7 ngày qua</SelectItem>
                <SelectItem value="30days">30 ngày qua</SelectItem>
                <SelectItem value="thisMonth">Tháng này</SelectItem>
                <SelectItem value="lastMonth">Tháng trước</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters button */}
          {(dateFrom || dateTo) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
                applyQuickFilter("all");
              }}
              className="text-muted-foreground"
            >
              Xóa lọc ngày
            </Button>
          )}
        </div>

        {/* Row 2: Search Box + Status Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm nhà cung cấp, tên/mã sản phẩm, ngày (dd/mm)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Lọc theo trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending">Chờ Hàng</SelectItem>
              <SelectItem value="received">Đã Nhận Hàng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày đặt</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Hóa đơn (VND)</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Mã sản phẩm</TableHead>
              <TableHead>TPOS ID</TableHead>
              <TableHead>Biến thể</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Giá mua (VND)</TableHead>
              <TableHead>Giá bán (VND)</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <span>Thao tác</span>
                  <Checkbox
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Chọn tất cả"
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flattenedItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Không có đơn hàng nào
                </TableCell>
              </TableRow>
            ) : (
              flattenedItems?.map((flatItem, index) => {
                const isSelected = selectedOrders.includes(flatItem.id);
                
                // Lấy thông tin từ product hoặc snapshot
                const productName = flatItem.item?.product?.product_name || flatItem.item?.product_name_snapshot || "Sản phẩm đã xóa";
                const productCode = flatItem.item?.product?.product_code || flatItem.item?.product_code_snapshot || "-";
                const variant = flatItem.item?.product?.variant || flatItem.item?.variant_snapshot || "-";
                const purchasePrice = flatItem.item?.product?.purchase_price || flatItem.item?.purchase_price_snapshot || 0;
                const sellingPrice = flatItem.item?.product?.selling_price || flatItem.item?.selling_price_snapshot || 0;
                const productImages = flatItem.item?.product?.product_images || flatItem.item?.product_images_snapshot || [];
                const priceImages = flatItem.item?.product?.price_images || flatItem.item?.price_images_snapshot || [];

                return (
                  <TableRow 
                    key={`${flatItem.id}-${index}`} 
                    className={cn(
                      "border-b", 
                      isSelected && "bg-muted/50",
                      flatItem.hasDeletedProduct && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {/* Order-level columns with rowSpan - only show on first item */}
                    {flatItem.isFirstItem && (
                      <>
                      <TableCell 
                        className="border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        <div className="flex flex-col gap-1">
                          {/* Ngày đặt hàng (do user chọn) */}
                          <div className="flex items-center gap-2 font-medium">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(flatItem.order_date), "dd/MM/yyyy", { locale: vi })}
                          </div>
                          
                          {/* Ngày giờ tạo trên hệ thống */}
                          <div className="text-xs text-muted-foreground ml-6">
                            ({format(new Date(flatItem.created_at), "dd/MM HH:mm", { locale: vi })})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell 
                        className="font-medium border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        <div className="flex flex-col gap-1">
                          <div>{flatItem.supplier_name || "Chưa cập nhật"}</div>
                          <div className="text-xs text-muted-foreground">
                            Tổng SL: {(flatItem.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell 
                        className={`overflow-visible border-r ${
                          (() => {
                            const calculatedTotal = (flatItem.items || []).reduce((sum, item) => 
                              sum + ((item.product?.purchase_price || item.purchase_price_snapshot || 0) * (item.quantity || 0)), 
                            0);
                            const calculatedFinalAmount = calculatedTotal - (flatItem.discount_amount || 0) + (flatItem.shipping_fee || 0);
                            const hasMismatch = Math.abs(calculatedFinalAmount - (flatItem.final_amount || 0)) > 0.01;
                            return hasMismatch ? 'bg-red-100 border-2 border-red-300' : '';
                          })()
                        }`}
                        rowSpan={flatItem.itemCount}
                      >
                        <div className="space-y-2 relative">
                          {flatItem.invoice_images && flatItem.invoice_images.length > 0 && (
                            <img 
                              src={flatItem.invoice_images[0]}
                              alt="Hóa đơn"
                              className="w-20 h-20 object-cover rounded cursor-pointer transition-transform duration-200 hover:scale-[7] hover:z-50 relative origin-left"
                            />
                          )}
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-blue-600">
                              {formatVND(flatItem.final_amount || 0)}
                            </div>
                            {(() => {
                              const calculatedTotal = (flatItem.items || []).reduce((sum, item) => 
                                sum + ((item.product?.purchase_price || item.purchase_price_snapshot || 0) * (item.quantity || 0)), 
                              0);
                              const calculatedFinalAmount = calculatedTotal - (flatItem.discount_amount || 0) + (flatItem.shipping_fee || 0);
                              const hasMismatch = Math.abs(calculatedFinalAmount - (flatItem.final_amount || 0)) > 0.01;
                              
                              if (hasMismatch) {
                                return (
                                  <div className="text-xs font-semibold text-red-600">
                                    Thành tiền: {formatVND(calculatedFinalAmount)}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </TableCell>
                    </>
                  )}
                  
                  {/* Item-level columns */}
                  <TableCell className="border-r">
                    <div className="font-medium">
                      {productName}
                    </div>
                  </TableCell>
                  <TableCell className="border-r">
                    {productCode}
                  </TableCell>
                  <TableCell className="border-r">
                    {flatItem.item?.tpos_product_id ? (
                      <div className="flex items-center gap-1">
                        <a 
                          href={generateTPOSProductLink(flatItem.item.tpos_product_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          {flatItem.item.tpos_product_id}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                    <TableCell className="border-r">
                      {variant}
                    </TableCell>
                    <TableCell className="border-r text-center">
                      {flatItem.item?.quantity || 0}
                    </TableCell>
                  <TableCell className="border-r text-right overflow-visible">
                    <div className="flex flex-col items-end gap-1">
                      {priceImages && priceImages.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {priceImages.map((imageUrl, index) => (
                            <img
                              key={index}
                              src={imageUrl}
                              alt={`Giá mua ${index + 1}`}
                              className="w-8 h-8 object-cover rounded border cursor-pointer transition-transform duration-200 hover:scale-[14] hover:z-50 relative origin-left"
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa có hình</span>
                      )}
                      <span>{formatVND(purchasePrice || 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="border-r text-right overflow-visible">
                    <div className="flex flex-col items-end gap-1">
                      {productImages && productImages.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {productImages.map((imageUrl, index) => (
                            <img
                              key={index}
                              src={imageUrl}
                              alt={`Sản phẩm ${index + 1}`}
                              className="w-8 h-8 object-cover rounded border cursor-pointer transition-transform duration-200 hover:scale-[14] hover:z-50 relative origin-left"
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa có hình</span>
                      )}
                      <span>{formatVND(sellingPrice || 0)}</span>
                    </div>
                  </TableCell>
                  
                  {flatItem.isFirstItem && (
                    <>
                      <TableCell 
                        className="border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        {flatItem.notes && (
                          <div className="max-w-32">
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto text-left justify-start">
                                  <div className="truncate text-xs">
                                    {flatItem.notes.substring(0, 20)}
                                    {flatItem.notes.length > 20 && "..."}
                                  </div>
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <div className="text-sm">{flatItem.notes}</div>
                              </HoverCardContent>
                            </HoverCard>
                          </div>
                        )}
                      </TableCell>
                      <TableCell 
                        className="border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        {getStatusBadge(flatItem.status, flatItem.hasShortage)}
                      </TableCell>
                      <TableCell rowSpan={flatItem.itemCount}>
                        <div className="flex items-center gap-2">
                          {!flatItem.hasDeletedProduct && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOrder(flatItem)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOrder(flatItem)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleSelect(flatItem.id)}
                            aria-label={`Chọn đơn hàng ${flatItem.supplier_name}`}
                          />
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })
            )}
          </TableBody>
        </Table>
      </div>

      <EditPurchaseOrderDialog
        order={editingOrder}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đơn hàng này? Tất cả sản phẩm trong đơn hàng cũng sẽ bị xóa. 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}