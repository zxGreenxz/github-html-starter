import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, FileText, Download, ShoppingCart, Trash2, X, Upload } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { CreatePurchaseOrderDialog } from "@/components/purchase-orders/CreatePurchaseOrderDialog";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { format } from "date-fns";
import { convertVietnameseToUpperCase, cn } from "@/lib/utils";
import { generateVariantCode, generateProductNameWithVariant } from "@/lib/variant-compat-exports";
import { useIsMobile } from "@/hooks/use-mobile";
import { BulkTPOSUploadDialog } from "@/components/purchase-orders/BulkTPOSUploadDialog";
import type { TPOSProductItem } from "@/lib/tpos-api";

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
  invoice_date: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
  hasShortage?: boolean;
  hasDeletedProduct?: boolean;
}

const PurchaseOrders = () => {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isUploadTPOSDialogOpen, setIsUploadTPOSDialogOpen] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<PurchaseOrder | null>(null);
  const isMobile = useIsMobile();
  
  const queryClient = useQueryClient();

  // Helper function to format date as DD-MM
  const formatDateDDMM = () => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  };

  // Helper function to get supplier list
  const getSupplierList = (orders: PurchaseOrder[]) => {
    const suppliers = orders
      .map(order => order.supplier_name)
      .filter((name): name is string => name !== null && name !== undefined);
    const uniqueSuppliers = Array.from(new Set(suppliers));
    return uniqueSuppliers.join('-') || 'NoSupplier';
  };
  
  // Selection management functions
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(order => order.id));
    }
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  // Filter states moved from PurchaseOrderList
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>("all");

  const applyQuickFilter = (filterType: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(filterType) {
      case "today":
        setDateFrom(today);
        setDateTo(new Date());
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFrom(yesterday);
        setDateTo(yesterday);
        break;
      case "7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        setDateFrom(sevenDaysAgo);
        setDateTo(new Date());
        break;
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setDateFrom(thirtyDaysAgo);
        setDateTo(new Date());
        break;
      case "thisMonth":
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(firstDayOfMonth);
        setDateTo(new Date());
        break;
      case "lastMonth":
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFrom(firstDayOfLastMonth);
        setDateTo(lastDayOfLastMonth);
        break;
      case "all":
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
    }
    setQuickFilter(filterType);
  };

  // Data fetching moved from PurchaseOrderList - OPTIMIZED to reduce queries
  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      // Single optimized query to fetch orders, items, and receiving data
      const { data: ordersData, error: ordersError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            id,
            quantity,
            position,
            notes,
            product_code,
            product_name,
            variant,
            purchase_price,
            selling_price,
            product_images,
            price_images,
            tpos_product_id
          ),
          receiving:goods_receiving(
            id,
            has_discrepancy,
            items:goods_receiving_items(
              discrepancy_type,
              discrepancy_quantity
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Process orders to add hasShortage flag
      const ordersWithStatus = (ordersData || []).map((order: any) => {
        let hasShortage = false;
        
        // Check if there's any shortage in goods_receiving_items
        if (order.receiving && order.receiving.length > 0) {
          const receivingRecord = order.receiving[0]; // Get first receiving record
          if (receivingRecord.items && receivingRecord.items.length > 0) {
            hasShortage = receivingRecord.items.some(
              (item: any) => item.discrepancy_type === 'shortage'
            );
          }
        }

        // Sort items by position
        const sortedItems = (order.items || []).sort((a: any, b: any) => 
          (a.position || 0) - (b.position || 0)
        );

        return {
          ...order,
          items: sortedItems,
          hasShortage,
          hasDeletedProduct: false // No longer checking product relationship
        };
      });

      return ordersWithStatus as PurchaseOrder[];
    }
  });

  // Filtering logic moved from PurchaseOrderList
  const filteredOrders = orders?.filter(order => {
    // Date range filter
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.created_at);
      orderDate.setHours(0, 0, 0, 0);
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (orderDate < fromDate) return false;
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }
    }
    
    // Enhanced search - bao gồm search theo định dạng ngày dd/mm
    const matchesSearch = searchTerm === "" || 
      order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      format(new Date(order.created_at), "dd/MM").includes(searchTerm) ||
      format(new Date(order.created_at), "dd/MM/yyyy").includes(searchTerm) ||
      order.items?.some(item => 
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    // Status filter - "pending" includes both pending and draft orders
    const matchesStatus = statusFilter === "all" || 
      order.status === statusFilter ||
      (statusFilter === "pending" && order.status === "draft");
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Separate draft orders from active orders
  const draftOrders = orders?.filter(order => order.status === 'draft') || [];
  // Keep draft orders in activeOrders only when statusFilter is NOT "all" and NOT specifically filtering drafts
  const activeOrders = statusFilter === "pending" 
    ? filteredOrders  // Show both pending and draft when filter is "pending"
    : filteredOrders.filter(order => order.status !== 'draft');  // Hide draft from other views

  const handleEditDraft = (order: PurchaseOrder) => {
    setDraftToEdit(order);
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setDraftToEdit(null);
    }
  };

  const handleExportExcel = () => {
    // Use selected orders if any, otherwise use filtered orders
    const ordersToExport = selectedOrders.length > 0 
      ? orders?.filter(order => selectedOrders.includes(order.id)) || []
      : filteredOrders;

    // Flatten all items from orders to export
    const products = ordersToExport.flatMap(order => 
      (order.items || []).map(item => ({
        ...item,
        order_id: order.id,
        order_date: order.created_at,
        supplier_name: order.supplier_name,
        order_notes: order.notes
      }))
    );

    if (products.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có sản phẩm nào để xuất",
        variant: "destructive",
      });
      return;
    }

    try {
      // Mapping according to the Excel template format (17 columns)
      const excelData = products.map(item => ({
        "Loại sản phẩm": "Có thể lưu trữ",
        "Mã sản phẩm": item.product_code?.toString() || undefined,
        "Mã chốt đơn": undefined,
        "Tên sản phẩm": item.product_name?.toString() || undefined,
        "Giá bán": item.selling_price || 0,
        "Giá mua": item.purchase_price || 0,
        "Đơn vị": "CÁI",
        "Nhóm sản phẩm": "QUẦN ÁO",
        "Mã vạch": item.product_code?.toString() || undefined,
        "Khối lượng": undefined,
        "Chiết khấu bán": undefined,
        "Chiết khấu mua": undefined,
        "Tồn kho": undefined,
        "Giá vốn": undefined,
        "Ghi chú": undefined,
        "Cho phép bán ở công ty khác": "FALSE",
        "Thuộc tính": undefined,
      }));

      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Đặt Hàng");
      
      const fileName = `TaoMaSP_${formatDateDDMM()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Xuất Excel thành công!",
        description: `Đã tạo file ${fileName}`,
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({
        title: "Lỗi khi xuất Excel!",
        description: "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };

  const handleExportPurchaseExcel = async () => {
    // Use selected orders if any, otherwise use filtered orders
    const ordersToExport = selectedOrders.length > 0 
      ? orders?.filter(order => selectedOrders.includes(order.id)) || []
      : filteredOrders;

    if (ordersToExport.length === 0) {
      toast({
        title: "Không có đơn hàng",
        description: "Vui lòng chọn ít nhất một đơn hàng",
        variant: "destructive",
      });
      return;
    }

    // Check number of unique suppliers
    const uniqueSuppliers = new Set(ordersToExport.map(order => order.supplier_name));

    if (uniqueSuppliers.size > 1) {
      toast({
        title: "Không thể xuất Excel",
        description: `Đang chọn ${uniqueSuppliers.size} nhà cung cấp khác nhau. Vui lòng chỉ chọn đơn hàng từ 1 nhà cung cấp để xuất.`,
        variant: "destructive",
      });
      return;
    }

    // Flatten all items from ordersToExport
    const products = ordersToExport.flatMap(order =>
      (order.items || []).map(item => ({
        ...item,
        order_id: order.id,
        order_date: order.created_at,
        supplier_name: order.supplier_name,
        order_notes: order.notes,
        discount_amount: order.discount_amount || 0,
        total_amount: order.total_amount || 0
      }))
    );

    if (products.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có sản phẩm nào để xuất",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get all unique product codes
      const allProductCodes = [...new Set(products.map(p => p.product_code))];

      // Query all children in one go for efficiency
      const { data: allChildren } = await supabase
        .from('products')
        .select('product_code, base_product_code')
        .in('base_product_code', allProductCodes);

      // Group children by base_product_code (exclude self-reference)
      const childrenMap: Record<string, any[]> = {};
      allChildren?.forEach(child => {
        // Only add if product_code is different from base_product_code (exclude parent itself)
        if (child.product_code !== child.base_product_code) {
          if (!childrenMap[child.base_product_code]) {
            childrenMap[child.base_product_code] = [];
          }
          childrenMap[child.base_product_code].push(child);
        }
      });

      // Expand parent products into child variants
      const expandedProducts = products.flatMap(item => {
        const children = childrenMap[item.product_code] || [];
        if (children.length > 0) {
          // Parent has children → Replace with children, each with quantity = 1
          return children.map(child => ({
            ...item,
            product_code: child.product_code,
            quantity: 1
          }));
        }
        // No children → Keep original item
        return [item];
      });

      // Calculate discount percentage for each item
      const excelData = expandedProducts.map(item => {
        return {
          "Mã sản phẩm (*)": item.product_code?.toString() || "",
          "Số lượng (*)": item.quantity || 0,
          "Đơn giá": item.purchase_price || 0,
          "Chiết khấu (%)": 0,
        };
      });

      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mua Hàng");
      
      const fileName = `MuaHang_${getSupplierList(ordersToExport)}_${formatDateDDMM()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Xuất Excel thành công!",
        description: `Đã tạo file ${fileName}`,
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({
        title: "Lỗi khi xuất Excel!",
        description: "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };


  // Bulk delete mutation
  const deleteBulkOrdersMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const results = [];
      for (const orderId of orderIds) {
        try {
          // Step 1: Get all purchase_order_item IDs
          const { data: itemIds } = await supabase
            .from("purchase_order_items")
            .select("id")
            .eq("purchase_order_id", orderId);

          if (itemIds && itemIds.length > 0) {
            const itemIdList = itemIds.map(item => item.id);
            
            // Step 2: Delete goods_receiving_items first
            await supabase
              .from("goods_receiving_items")
              .delete()
              .in("purchase_order_item_id", itemIdList);
          }

          // Step 3: Delete goods_receiving records
          await supabase
            .from("goods_receiving")
            .delete()
            .eq("purchase_order_id", orderId);

          // Step 4: Delete purchase_order_items
          await supabase
            .from("purchase_order_items")
            .delete()
            .eq("purchase_order_id", orderId);

          // Step 5: Delete purchase_order
          await supabase
            .from("purchase_orders")
            .delete()
            .eq("id", orderId);

          results.push({ orderId, success: true });
        } catch (error) {
          results.push({ orderId, success: false, error });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      toast({
        title: `Đã xóa ${successCount} đơn hàng`,
        description: failCount > 0 
          ? `${failCount} đơn không thể xóa` 
          : "Tất cả đơn đã được xóa thành công",
        variant: failCount > 0 ? "destructive" : "default"
      });
      
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa các đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
      console.error("Error bulk deleting orders:", error);
    }
  });

  const handleBulkDelete = () => {
    if (selectedOrders.length === 0) return;
    
    if (confirm(`Bạn có chắc muốn xóa ${selectedOrders.length} đơn hàng đã chọn?`)) {
      deleteBulkOrdersMutation.mutate(selectedOrders);
    }
  };

  // Convert selected purchase orders to TPOSProductItem format
  const getSelectedTPOSItems = (): TPOSProductItem[] => {
    // Filter out draft orders - only include pending or other valid statuses
    const selectedOrdersData = orders?.filter(order => 
      selectedOrders.includes(order.id) && order.status !== 'draft'
    ) || [];
    
    const items: TPOSProductItem[] = [];
    selectedOrdersData.forEach(order => {
      order.items?.forEach(item => {
        items.push({
          id: item.id || crypto.randomUUID(),
          product_code: item.product_code,
          base_product_code: undefined,
          product_name: item.product_name,
          variant: item.variant,
          quantity: item.quantity,
          unit_price: item.purchase_price,
          selling_price: item.selling_price,
          product_images: item.product_images,
          price_images: item.price_images,
          purchase_order_id: order.id,
          supplier_name: order.supplier_name,
        });
      });
    });
    
    return items;
  };

  return (
    <div className={cn(
      "mx-auto space-y-6",
      isMobile ? "p-4" : "container p-6"
    )}>
      <div className={cn(
        "flex items-center",
        isMobile ? "flex-col items-start gap-3 w-full" : "justify-between"
      )}>
        <div>
          <h1 className={cn(
            "font-bold tracking-tight",
            isMobile ? "text-xl" : "text-3xl"
          )}>Quản lý đặt hàng</h1>
          <p className={cn(
            "text-muted-foreground",
            isMobile ? "text-sm" : "text-base"
          )}>
            Theo dõi và quản lý đơn đặt hàng với các nhà cung cấp
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          size={isMobile ? "sm" : "default"}
          className={cn("gap-2", isMobile && "w-full")}
        >
          <Plus className="w-4 h-4" />
          Tạo đơn đặt hàng
        </Button>
      </div>

      <PurchaseOrderStats 
        filteredOrders={filteredOrders}
        allOrders={orders || []}
        isLoading={isLoading}
        isMobile={isMobile}
      />

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="w-4 h-4" />
            Đơn hàng
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2">
            <FileText className="w-4 h-4" />
            Nháp ({draftOrders.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" />
            Sản phẩm đã đặt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Danh sách đơn đặt hàng</CardTitle>
                    <CardDescription>
                      Xem và quản lý tất cả đơn đặt hàng với nhà cung cấp
                    </CardDescription>
                  </div>
                </div>

                {/* Bulk selection actions */}
                {selectedOrders.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">
                      Đã chọn: <span className="text-primary">{selectedOrders.length}</span> đơn hàng
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        onClick={clearSelection} 
                        variant="outline" 
                        size="sm"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Bỏ chọn
                      </Button>
                      <Button 
                        onClick={() => setIsUploadTPOSDialogOpen(true)} 
                        variant="default" 
                        size="sm"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload TPOS
                      </Button>
                      <Button 
                        onClick={handleBulkDelete} 
                        variant="destructive" 
                        size="sm"
                        disabled={deleteBulkOrdersMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Xóa đã chọn
                      </Button>
                      <Button onClick={handleExportPurchaseExcel} variant="outline" size="sm">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Xuất Excel Mua hàng
                      </Button>
                      <Button onClick={handleExportExcel} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Xuất Excel Thêm SP
                      </Button>
                    </div>
                  </div>
                )}

                {/* Regular export actions */}
                <div className="flex gap-2">
                  <Button onClick={handleExportPurchaseExcel} variant="outline" className="gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Xuất Excel mua hàng
                  </Button>
                  <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Xuất Excel Thêm SP
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <PurchaseOrderList
              filteredOrders={activeOrders}
              isLoading={isLoading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              quickFilter={quickFilter}
              applyQuickFilter={applyQuickFilter}
              selectedOrders={selectedOrders}
              onToggleSelect={toggleSelectOrder}
              onToggleSelectAll={toggleSelectAll}
              onEditDraft={handleEditDraft}
            />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Đơn hàng nháp</CardTitle>
              <CardDescription>
                Các đơn đặt hàng đã lưu nháp, chưa hoàn tất
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PurchaseOrderList
                filteredOrders={draftOrders}
                isLoading={isLoading}
                searchTerm=""
                setSearchTerm={() => {}}
                statusFilter="all"
                setStatusFilter={() => {}}
                dateFrom={undefined}
                setDateFrom={() => {}}
                dateTo={undefined}
                setDateTo={() => {}}
                quickFilter="all"
                applyQuickFilter={() => {}}
                selectedOrders={[]}
                onToggleSelect={() => {}}
                onToggleSelectAll={() => {}}
                onEditDraft={handleEditDraft}
              />
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="products" className="space-y-4">
          <Card>
          <CardHeader>
              <CardTitle>Sản phẩm đã đặt</CardTitle>
              <CardDescription>
                Xem danh sách các sản phẩm đã đặt hàng từ nhà cung cấp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Chức năng đang phát triển</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreatePurchaseOrderDialog 
        open={isCreateDialogOpen}
        onOpenChange={handleCloseCreateDialog}
        initialData={draftToEdit}
      />

      <BulkTPOSUploadDialog
        open={isUploadTPOSDialogOpen}
        onOpenChange={setIsUploadTPOSDialogOpen}
        items={getSelectedTPOSItems()}
        onSuccess={() => {
          toast({
            title: "Upload thành công",
            description: "Các sản phẩm đã được upload lên TPOS",
          });
          setIsUploadTPOSDialogOpen(false);
        }}
      />

    </div>
  );
};

export default PurchaseOrders;