import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Pencil, Search, Filter, Calendar, Trash2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import React, { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EditPurchaseOrderDialog } from "./EditPurchaseOrderDialog";
import { useToast } from "@/hooks/use-toast";
import { formatVND } from "@/lib/currency-utils";
import { formatVariantForDisplay } from "@/lib/variant-display-utils";

interface PurchaseOrderItem {
  id?: string;
  quantity: number;
  position?: number;
  notes?: string | null;
  // Primary fields (renamed from snapshot)
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
  tpos_product_id?: number | null;
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
  onEditDraft?: (order: PurchaseOrder) => void;
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
  onEditDraft,
}: PurchaseOrderListProps) {
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PurchaseOrderItem | null>(null);
  
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

  // Get all product codes from filtered orders
  const allProductCodes = React.useMemo(() => {
    return filteredOrders.flatMap(order => 
      order.items?.map(item => item.product_code) || []
    );
  }, [filteredOrders]);

  // Query variant info: count and total stock of child products
  const { data: variantInfo } = useQuery({
    queryKey: ['variant-stock-info', allProductCodes],
    queryFn: async () => {
      if (allProductCodes.length === 0) return {};
      
      const { data: childProducts, error } = await supabase
        .from('products')
        .select('base_product_code, stock_quantity')
        .in('base_product_code', allProductCodes)
        .not('base_product_code', 'is', null);
      
      if (error) {
        console.error('Error fetching variant info:', error);
        return {};
      }
      
      // Calculate total stock for each parent product
      const info: Record<string, number> = {};
      
      allProductCodes.forEach(code => {
        const variants = childProducts?.filter(p => p.base_product_code === code) || [];
        
        if (variants.length > 0) {
          // Sum stock_quantity of all child products
          info[code] = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        } else {
          // No child products -> standalone product
          info[code] = 1;
        }
      });
      
      return info;
    },
    enabled: allProductCodes.length > 0
  });

  const getStatusBadge = (status: string, hasShortage?: boolean) => {
    // Prioritize showing "Giao thiếu hàng" if received with shortage
    if (status === "received" && hasShortage) {
      return <Badge variant="destructive">Giao thiếu hàng</Badge>;
    }
    
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Nháp</Badge>;
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

  const handleDeleteItem = (item: PurchaseOrderItem) => {
    setItemToDelete(item);
    setIsDeleteItemDialogOpen(true);
  };

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Delete goods_receiving_items first
      const { error: receivingError } = await supabase
        .from("goods_receiving_items")
        .delete()
        .eq("purchase_order_item_id", itemId);
      
      if (receivingError) throw receivingError;
      
      // Delete purchase_order_item
      const { error: itemError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("id", itemId);
      
      if (itemError) throw itemError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: "Thành công",
        description: "Sản phẩm đã được xóa",
      });
      setIsDeleteItemDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa sản phẩm",
        variant: "destructive",
      });
      console.error("Error deleting item:", error);
    }
  });

  const confirmDeleteItem = () => {
    if (itemToDelete && itemToDelete.id) {
      deleteItemMutation.mutate(itemToDelete.id);
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
              <TableHead>Biến thể</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Giá mua (VND)</TableHead>
              <TableHead>Giá bán (VND)</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="border-r text-center">Chỉnh sửa ĐH</TableHead>
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
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  Không có đơn hàng nào
                </TableCell>
              </TableRow>
            ) : (
              flattenedItems?.map((flatItem, index) => {
                const isSelected = selectedOrders.includes(flatItem.id);
                
                // Use direct fields from purchase_order_items
                const productName = flatItem.item?.product_name || "Sản phẩm đã xóa";
                const productCode = flatItem.item?.product_code || "-";
                const variant = flatItem.item?.variant || "-";
                const purchasePrice = flatItem.item?.purchase_price || 0;
                const sellingPrice = flatItem.item?.selling_price || 0;
                const productImages = flatItem.item?.product_images || [];
                const priceImages = flatItem.item?.price_images || [];

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
                              sum + ((item.purchase_price || 0) * (item.quantity || 0)), 
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
                                sum + ((item.purchase_price || 0) * (item.quantity || 0)), 
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
                    {formatVariantForDisplay(variant)}
                  </TableCell>
                  <TableCell className="border-r text-center">
                    <div className="font-medium">
                      {flatItem.item?.quantity || 0}
                    </div>
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
                      {/* Order-level Edit Button */}
                      <TableCell 
                        className="border-r text-center" 
                        rowSpan={flatItem.itemCount}
                      >
                        {flatItem.status === 'draft' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditDraft?.(flatItem)}
                            title="Chỉnh sửa nháp"
                          >
                            <Pencil className="w-4 h-4 text-amber-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOrder(flatItem)}
                            title="Chỉnh sửa đơn hàng"
                          >
                            <Pencil className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                      </TableCell>
                    </>
                  )}
                  
                  {/* Item-level actions - each item has its own buttons */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Delete button for each item */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(flatItem.item!)}
                        className="text-destructive hover:text-destructive"
                        title="Xóa sản phẩm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      
                      {/* Order selection checkbox - only on first item with rowSpan */}
                      {flatItem.isFirstItem && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(flatItem.id)}
                          aria-label={`Chọn đơn hàng ${flatItem.supplier_name}`}
                        />
                      )}
                    </div>
                  </TableCell>
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
            <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
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

      <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa sản phẩm "{itemToDelete?.product_name}"? 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteItem}
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