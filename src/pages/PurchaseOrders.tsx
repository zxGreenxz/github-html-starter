import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, FileText, Download, ShoppingCart, FileSpreadsheet, Trash2, X, Upload, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { CreatePurchaseOrderDialog } from "@/components/purchase-orders/CreatePurchaseOrderDialog";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { ExportTPOSDialog } from "@/components/purchase-orders/ExportTPOSDialog";

import type { TPOSProductItem } from "@/lib/tpos-api";
import { checkTPOSProductsExist } from "@/lib/tpos-api";
import { format } from "date-fns";
import { convertVietnameseToUpperCase, cn } from "@/lib/utils";
import { generateVariantCode, generateProductNameWithVariant } from "@/lib/variant-attributes";
import { useIsMobile } from "@/hooks/use-mobile";

interface PurchaseOrderItem {
  id?: string;
  product_id: string;
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
  const [isTPOSDialogOpen, setIsTPOSDialogOpen] = useState(false);
  const [tposItems, setTposItems] = useState<TPOSProductItem[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isCheckingTPOS, setIsCheckingTPOS] = useState(false);
  const [deletedTPOSIds, setDeletedTPOSIds] = useState<Set<number>>(new Set());
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

  // Check TPOS sync status
  const handleCheckTPOSSync = async () => {
    const allItems = orders?.flatMap(order => order.items || []) || [];
    const tposIds = allItems
      .filter(item => item.tpos_product_id)
      .map(item => item.tpos_product_id as number);

    if (tposIds.length === 0) {
      toast({
        title: "Không có sản phẩm để kiểm tra",
        description: "Chưa có sản phẩm nào được đồng bộ lên TPOS",
      });
      return;
    }

    setIsCheckingTPOS(true);
    toast({
      title: "Đang kiểm tra TPOS...",
      description: `Đang kiểm tra ${tposIds.length} sản phẩm trên TPOS`,
    });

    try {
      const existenceMap = await checkTPOSProductsExist(tposIds);
      const deletedIds = new Set<number>();
      const itemsToUpdate: string[] = [];
      
      existenceMap.forEach((exists, id) => {
        if (!exists) {
          deletedIds.add(id);
          // Find all item IDs with this TPOS ID
          const itemIds = allItems
            .filter(item => item.tpos_product_id === id && item.id)
            .map(item => item.id as string);
          itemsToUpdate.push(...itemIds);
        }
      });

      setDeletedTPOSIds(deletedIds);

      // Update database: set tpos_product_id to null and mark as deleted
      if (itemsToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from("purchase_order_items")
          .update({ 
            tpos_product_id: null,
            tpos_deleted: true,
            tpos_deleted_at: new Date().toISOString()
          })
          .in("id", itemsToUpdate);

        if (updateError) {
          console.error("Error updating items:", updateError);
          toast({
            title: "⚠️ Lỗi cập nhật",
            description: "Không thể cập nhật trạng thái sản phẩm trong database",
            variant: "destructive",
          });
        } else {
          // Refresh data after update
          queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
        }
      }

      const deletedCount = deletedIds.size;
      const activeCount = tposIds.length - deletedCount;

      toast({
        title: "✅ Kiểm tra hoàn tất",
        description: `Còn ${activeCount}/${tposIds.length} sản phẩm trên TPOS${deletedCount > 0 ? ` (${deletedCount} đã bị xóa và đã xóa TPOS ID khỏi database)` : ''}`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error checking TPOS sync:", error);
      toast({
        title: "❌ Lỗi kiểm tra",
        description: "Không thể kiểm tra trạng thái trên TPOS",
        variant: "destructive",
      });
    } finally {
      setIsCheckingTPOS(false);
    }
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
      // Single optimized query with JOIN to fetch orders, items, and receiving data
      const { data: ordersData, error: ordersError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            id,
            product_id,
            quantity,
            position,
            notes,
            tpos_product_id,
            tpos_deleted,
            tpos_deleted_at,
            product_code_snapshot,
            product_name_snapshot,
            variant_snapshot,
            purchase_price_snapshot,
            selling_price_snapshot,
            product_images_snapshot,
            price_images_snapshot,
            product:products(
              product_name,
              product_code,
              variant,
              purchase_price,
              selling_price,
              product_images,
              price_images,
              base_product_code
            )
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

        // Check for items with deleted products
        const hasDeletedProduct = sortedItems.some((item: any) => !item.product);

        return {
          ...order,
          items: sortedItems,
          hasShortage,
          hasDeletedProduct
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
        item.product?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    // Status filter
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

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
        "Mã sản phẩm": item.product?.product_code?.toString() || undefined,
        "Mã chốt đơn": undefined,
        "Tên sản phẩm": item.product?.product_name?.toString() || undefined,
        "Giá bán": item.product?.selling_price || 0,
        "Giá mua": item.product?.purchase_price || 0,
        "Đơn vị": "CÁI",
        "Nhóm sản phẩm": "QUẦN ÁO",
        "Mã vạch": item.product?.product_code?.toString() || undefined,
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

  const handleExportPurchaseExcel = () => {
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
      // Calculate discount percentage for each item
      const excelData = products.map(item => {
        return {
          "Mã sản phẩm (*)": item.product?.product_code?.toString() || "",
          "Số lượng (*)": item.quantity || 0,
          "Đơn giá": item.product?.purchase_price || 0,
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


  const handleExportToTPOS = async () => {
    // Use selected orders if any, otherwise use filtered orders
    const ordersToExport = selectedOrders.length > 0 
      ? orders?.filter(order => selectedOrders.includes(order.id)) || []
      : filteredOrders;

    // Flatten all items from orders to export
    const allItems: TPOSProductItem[] = ordersToExport.flatMap(order => 
      (order.items || []).map(item => ({
        id: item.id || crypto.randomUUID(),
        product_code: item.product?.product_code,
        base_product_code: item.product?.base_product_code,
        product_name: item.product?.product_name,
        variant: item.product?.variant,
        quantity: item.quantity,
        unit_price: item.product?.purchase_price || 0,
        selling_price: item.product?.selling_price || 0,
        product_images: item.product?.product_images,
        price_images: item.product?.price_images,
        purchase_order_id: order.id,
        supplier_name: order.supplier_name || '',
        tpos_product_id: item.tpos_product_id,
      }))
    );

    if (allItems.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có sản phẩm nào để xuất",
        variant: "destructive",
      });
      return;
    }

    setTposItems(allItems);
    setIsTPOSDialogOpen(true);
  };

  const handleExportVariantsExcel = () => {
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
      // Step 1: Group products by product_code
      const productGroups = new Map<string, Array<typeof products[0]>>();
      
      products.forEach(item => {
        const code = item.product?.product_code?.toUpperCase() || "";
        if (!productGroups.has(code)) {
          productGroups.set(code, []);
        }
        productGroups.get(code)!.push(item);
      });

      // Step 2: Process each product group with its own variant code tracker
      const excelData: any[] = [];
      
      productGroups.forEach((items, productCode) => {
        // Reset usedVariantCodes for EACH product!
        const usedVariantCodes = new Set<string>();
        
        items.forEach(item => {
          let finalCode = productCode;
          let finalProductName = item.product?.product_name?.toString() || "";
          
          if (item.product?.variant) {
            const variantCode = generateVariantCode(item.product.variant, usedVariantCodes);
            finalCode = `${productCode}${variantCode}`;
            finalProductName = generateProductNameWithVariant(finalProductName, item.product.variant);
          }
          
          excelData.push({
            "Loại sản phẩm": "Có thể lưu trữ",
            "Mã sản phẩm": finalCode || undefined,
            "Mã chốt đơn": undefined,
            "Tên sản phẩm": finalProductName || undefined,
            "Giá bán": item.product?.selling_price || 0,
            "Giá mua": item.product?.purchase_price || 0,
            "Đơn vị": "CÁI",
            "Nhóm sản phẩm": "QUẦN ÁO",
            "Mã vạch": finalCode || undefined,
            "Khối lượng": undefined,
            "Chiết khấu bán": undefined,
            "Chiết khấu mua": undefined,
            "Tồn kho": undefined,
            "Giá vốn": undefined,
            "Ghi chú": undefined,
            "Cho phép bán ở công ty khác": "FALSE",
            "Thuộc tính": undefined,
          });
        });
      });

      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Đặt Hàng");
      
      const fileName = `TaoMaSP_BienThe_${formatDateDDMM()}.xlsx`;
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="w-4 h-4" />
            Đơn đặt hàng
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
                      <Button onClick={handleExportVariantsExcel} variant="outline" size="sm">
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Xuất Excel Biến thể
                      </Button>
                      <Button onClick={handleExportToTPOS} variant="default" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Export & Upload TPOS
                      </Button>
                    </div>
                  </div>
                )}

                {/* Regular export actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCheckTPOSSync} 
                    variant="outline" 
                    className="gap-2"
                    disabled={isCheckingTPOS}
                  >
                    <RefreshCw className={cn("w-4 h-4", isCheckingTPOS && "animate-spin")} />
                    {isCheckingTPOS ? "Đang kiểm tra..." : "Kiểm tra TPOS Sync"}
                  </Button>
                  <Button onClick={handleExportPurchaseExcel} variant="outline" className="gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Xuất Excel mua hàng
                  </Button>
                  <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Xuất Excel Thêm SP
                  </Button>
                  <Button onClick={handleExportVariantsExcel} variant="outline" className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Xuất Excel Biến thể
                  </Button>
                  <Button onClick={handleExportToTPOS} variant="default" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Export & Upload TPOS
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <PurchaseOrderList
              filteredOrders={filteredOrders}
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
              deletedTPOSIds={deletedTPOSIds}
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
        onOpenChange={setIsCreateDialogOpen}
      />

      <ExportTPOSDialog
        open={isTPOSDialogOpen}
        onOpenChange={setIsTPOSDialogOpen}
        items={tposItems}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        }}
      />

    </div>
  );
};

export default PurchaseOrders;