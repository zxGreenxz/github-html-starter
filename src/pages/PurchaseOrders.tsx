import { useState, useMemo } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

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
  selected_attribute_value_ids?: string[] | null;
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
  const [draftToEdit, setDraftToEdit] = useState<PurchaseOrder | null>(null);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>("drafts");
  
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

  /**
   * Simple variant matching (case-insensitive, remove accents)
   * Returns true if variants are similar enough
   */
  const variantsMatch = (variant1: string | null, variant2: string | null): boolean => {
    if (!variant1 || !variant2) return false;
    
    const normalize = (str: string) => 
      convertVietnameseToUpperCase(str.trim())
        .replace(/\s+/g, ' '); // Normalize spaces
    
    const v1 = normalize(variant1);
    const v2 = normalize(variant2);
    
    return v1 === v2;
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
    const currentOrders = activeTab === "awaiting_purchase" 
      ? filteredAwaitingPurchaseOrders 
      : filteredAwaitingDeliveryOrders;
    
    if (selectedOrders.length === currentOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(currentOrders.map(order => order.id));
    }
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  // Filter states moved from PurchaseOrderList
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("awaiting_export");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>("all");

  // Filter states for drafts tab
  const [searchTermDraft, setSearchTermDraft] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState<Date | undefined>(undefined);
  const [dateToDraft, setDateToDraft] = useState<Date | undefined>(undefined);
  const [quickFilterDraft, setQuickFilterDraft] = useState<string>("all");

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

  const applyQuickFilterDraft = (filterType: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(filterType) {
      case "today":
        setDateFromDraft(today);
        setDateToDraft(new Date());
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFromDraft(yesterday);
        setDateToDraft(yesterday);
        break;
      case "7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        setDateFromDraft(sevenDaysAgo);
        setDateToDraft(new Date());
        break;
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setDateFromDraft(thirtyDaysAgo);
        setDateToDraft(new Date());
        break;
      case "thisMonth":
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFromDraft(firstDayOfMonth);
        setDateToDraft(new Date());
        break;
      case "lastMonth":
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFromDraft(firstDayOfLastMonth);
        setDateToDraft(lastDayOfLastMonth);
        break;
      case "all":
        setDateFromDraft(undefined);
        setDateToDraft(undefined);
        break;
    }
    setQuickFilterDraft(filterType);
  };

  // Tab-specific queries for better performance
  
  // Query 1: Draft orders (only basic data)
  const { data: draftOrders, isLoading: isDraftLoading } = useQuery({
    queryKey: ["purchase-orders", "draft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            id, quantity, position, notes,
            product_code, product_name, variant,
            purchase_price, selling_price,
            product_images, price_images,
            tpos_product_id, selected_attribute_value_ids
          )
        `)
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((order: any) => ({
        ...order,
        items: (order.items || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
        hasShortage: false,
        hasDeletedProduct: false
      })) as PurchaseOrder[];
    },
    enabled: activeTab === "drafts",
    staleTime: 30000,
  });

  // Query 2: Awaiting purchase orders
  const { data: awaitingPurchaseOrders, isLoading: isAwaitingPurchaseLoading } = useQuery({
    queryKey: ["purchase-orders", "awaiting_purchase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            id, quantity, position, notes,
            product_code, product_name, variant,
            purchase_price, selling_price,
            product_images, price_images,
            tpos_product_id, selected_attribute_value_ids
          )
        `)
        .eq("status", "awaiting_export")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((order: any) => ({
        ...order,
        items: (order.items || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
        hasShortage: false,
        hasDeletedProduct: false
      })) as PurchaseOrder[];
    },
    enabled: activeTab === "awaiting_purchase",
    staleTime: 30000,
  });

  // Query 3: Awaiting delivery orders (includes goods_receiving)
  const { data: awaitingDeliveryOrders, isLoading: isAwaitingDeliveryLoading } = useQuery({
    queryKey: ["purchase-orders", "awaiting_delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            id, quantity, position, notes,
            product_code, product_name, variant,
            purchase_price, selling_price,
            product_images, price_images,
            tpos_product_id, selected_attribute_value_ids
          ),
          receiving:goods_receiving(
            id, has_discrepancy,
            items:goods_receiving_items(discrepancy_type, discrepancy_quantity)
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((order: any) => {
        let hasShortage = false;
        if (order.receiving?.[0]?.items) {
          hasShortage = order.receiving[0].items.some(
            (item: any) => item.discrepancy_type === 'shortage'
          );
        }
        
        return {
          ...order,
          items: (order.items || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
          hasShortage,
          hasDeletedProduct: false
        };
      }) as PurchaseOrder[];
    },
    enabled: activeTab === "awaiting_delivery",
    staleTime: 30000,
  });

  // Lightweight stats query
  const { data: allOrdersForStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["purchase-orders-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id, status, total_amount, final_amount, created_at,
          order_date, discount_amount, shipping_fee,
          invoice_number, supplier_name, supplier_id,
          notes, invoice_date, invoice_images, updated_at
        `)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(order => ({
        ...order,
        items: []
      })) as PurchaseOrder[];
    },
    staleTime: 60000,
  });

  // Memoized filtered data for each tab
  const filteredAwaitingPurchaseOrders = useMemo(() => {
    return (awaitingPurchaseOrders || []).filter(order => {
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
      
      const matchesSearch = searchTerm === "" || 
        order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        format(new Date(order.created_at), "dd/MM").includes(searchTerm) ||
        format(new Date(order.created_at), "dd/MM/yyyy").includes(searchTerm) ||
        order.items?.some(item => 
          item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      return matchesSearch;
    });
  }, [awaitingPurchaseOrders, dateFrom, dateTo, searchTerm]);

  const filteredAwaitingDeliveryOrders = useMemo(() => {
    return (awaitingDeliveryOrders || []).filter(order => {
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
      
      const matchesSearch = searchTerm === "" || 
        order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        format(new Date(order.created_at), "dd/MM").includes(searchTerm) ||
        format(new Date(order.created_at), "dd/MM/yyyy").includes(searchTerm) ||
        order.items?.some(item => 
          item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      return matchesSearch;
    });
  }, [awaitingDeliveryOrders, dateFrom, dateTo, searchTerm]);

  const filteredDraftOrders = useMemo(() => {
    return (draftOrders || []).filter(order => {
      if (dateFromDraft || dateToDraft) {
        const orderDate = new Date(order.created_at);
        orderDate.setHours(0, 0, 0, 0);
        
        if (dateFromDraft) {
          const fromDate = new Date(dateFromDraft);
          fromDate.setHours(0, 0, 0, 0);
          if (orderDate < fromDate) return false;
        }
        
        if (dateToDraft) {
          const toDate = new Date(dateToDraft);
          toDate.setHours(23, 59, 59, 999);
          if (orderDate > toDate) return false;
        }
      }
      
      const matchesSearch = searchTermDraft === "" || 
        order.supplier_name?.toLowerCase().includes(searchTermDraft.toLowerCase()) ||
        order.invoice_number?.toLowerCase().includes(searchTermDraft.toLowerCase()) ||
        format(new Date(order.created_at), "dd/MM").includes(searchTermDraft) ||
        format(new Date(order.created_at), "dd/MM/yyyy").includes(searchTermDraft) ||
        order.items?.some(item => 
          item.product_name?.toLowerCase().includes(searchTermDraft.toLowerCase()) ||
          item.product_code?.toLowerCase().includes(searchTermDraft.toLowerCase())
        );
      
      return matchesSearch;
    });
  }, [draftOrders, dateFromDraft, dateToDraft, searchTermDraft]);

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
    const currentOrders = activeTab === "awaiting_purchase" 
      ? filteredAwaitingPurchaseOrders 
      : filteredAwaitingDeliveryOrders;
    
    const ordersToExport = selectedOrders.length > 0 
      ? currentOrders.filter(order => selectedOrders.includes(order.id))
      : currentOrders;

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

  // Excel Mua Hàng Export
  const handleExportPurchaseExcel = async () => {
    // STEP 1: Validate chỉ 1 đơn hàng được chọn
    if (selectedOrders.length !== 1) {
      toast({
        title: "Vui lòng chọn 1 đơn hàng",
        description: "Chỉ được xuất Excel Mua Hàng từ 1 đơn hàng tại 1 thời điểm",
        variant: "destructive",
      });
      return;
    }

    // STEP 2: Lấy đơn hàng đã chọn
    const currentOrders = activeTab === "awaiting_purchase" 
      ? filteredAwaitingPurchaseOrders 
      : filteredAwaitingDeliveryOrders;
    
    const orderToExport = currentOrders.find(order => order.id === selectedOrders[0]);
    
    if (!orderToExport) {
      toast({
        title: "Không tìm thấy đơn hàng",
        variant: "destructive",
      });
      return;
    }

    // STEP 3: Lấy items từ đơn hàng
    const allItems = orderToExport.items || [];
    
    if (allItems.length === 0) {
      toast({
        title: "Không có sản phẩm",
        description: "Đơn hàng không có sản phẩm nào",
        variant: "destructive",
      });
      return;
    }

    // STEP 4: Process items (3 cases)
    try {
      const excelRows: Array<{
        "Mã sản phẩm (*)": string;
        "Số lượng (*)": number;
        "Đơn giá": number;
        "Chiết khấu (%)": number;
      }> = [];

      let skippedCount = 0;
      const skippedItems: string[] = [];

      for (const item of allItems) {
        // CASE 1: Đã upload TPOS
        if (item.tpos_product_id != null) {
          excelRows.push({
            "Mã sản phẩm (*)": item.product_code,
            "Số lượng (*)": item.quantity,
            "Đơn giá": item.purchase_price,
            "Chiết khấu (%)": 0
          });
          continue;
        }

        // CASE 2: Chưa upload + Không có biến thể
        if (!item.variant || item.variant.trim() === '') {
          excelRows.push({
            "Mã sản phẩm (*)": item.product_code,
            "Số lượng (*)": item.quantity,
            "Đơn giá": item.purchase_price,
            "Chiết khấu (%)": 0
          });
          continue;
        }

        // CASE 3: Chưa upload + Có biến thể → Matching
        const { data: candidates, error: candidatesError } = await supabase
          .from('products')
          .select('product_code, product_name, variant')
          .eq('base_product_code', item.product_code)
          .not('variant', 'is', null)
          .neq('variant', '');

        if (candidatesError) {
          console.error(`Error fetching candidates for ${item.product_code}:`, candidatesError);
          skippedCount++;
          skippedItems.push(`${item.product_code} (${item.variant}) - Lỗi query`);
          continue;
        }

        const matchedProduct = candidates?.find(p => 
          variantsMatch(p.variant, item.variant)
        );

        if (matchedProduct) {
          excelRows.push({
            "Mã sản phẩm (*)": matchedProduct.product_code,
            "Số lượng (*)": item.quantity,
            "Đơn giá": item.purchase_price,
            "Chiết khấu (%)": 0
          });
        } else {
          skippedCount++;
          const availableVariants = candidates
            ?.map(c => c.variant)
            .join(', ') || 'Không có';
          skippedItems.push(
            `${item.product_code} (${item.variant}) - Variants có: [${availableVariants}]`
          );
        }
      }

      // STEP 5: Validate có items để xuất
      if (excelRows.length === 0) {
        toast({
          title: "Không thể xuất Excel",
          description: "Không có sản phẩm nào phù hợp để xuất",
          variant: "destructive",
        });
        return;
      }

      // STEP 6: Create Excel file
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mua Hàng");
      
      const fileName = `MuaHang_${orderToExport.supplier_name}_${formatDateDDMM()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // STEP 7: Show success toast
      let description = `Đã xuất ${excelRows.length} sản phẩm`;
      if (skippedCount > 0) {
        description += `\n⚠️ Bỏ qua ${skippedCount} sản phẩm không match được variant`;
        console.warn('Skipped items:', skippedItems);
      }

      toast({
        title: "Xuất Excel thành công!",
        description: description,
      });

    } catch (error) {
      console.error("Error exporting purchase Excel:", error);
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
      queryClient.invalidateQueries({ queryKey: ["purchase-orders-stats"] });
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
      "mx-auto space-y-6 w-full",
      isMobile ? "p-4" : "p-6 max-w-[98%]"
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
        filteredOrders={
          activeTab === "drafts" ? filteredDraftOrders :
          activeTab === "awaiting_purchase" ? filteredAwaitingPurchaseOrders :
          filteredAwaitingDeliveryOrders
        }
        allOrders={allOrdersForStats || []}
        isLoading={isStatsLoading}
        isMobile={isMobile}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="drafts" className="gap-2">
            <FileText className="w-4 h-4" />
            Nháp ({draftOrders?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="awaiting_purchase" className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            Chờ mua
          </TabsTrigger>
          <TabsTrigger value="awaiting_delivery" className="gap-2">
            <Package className="w-4 h-4" />
            Chờ hàng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="awaiting_purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Đơn hàng chờ mua</CardTitle>
                    <CardDescription>
                      Đơn hàng đã export, đang chờ đặt mua từ nhà cung cấp
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
                      <Button onClick={handleExportExcel} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Xuất Excel Thêm SP
                      </Button>
                      <Button onClick={handleExportPurchaseExcel} variant="default" size="sm">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Xuất Excel Mua Hàng
                      </Button>
                    </div>
                  </div>
                )}

                {/* Regular export actions */}
                {selectedOrders.length > 0 && (
                  <div className="flex gap-2">
                    <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      Xuất Excel Thêm SP
                    </Button>
                    <Button onClick={handleExportPurchaseExcel} variant="default" className="gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Xuất Excel Mua Hàng
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
            {isAwaitingPurchaseLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <PurchaseOrderList
                filteredOrders={filteredAwaitingPurchaseOrders}
                isLoading={false}
                searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter="awaiting_export"
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
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="awaiting_delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Đơn hàng chờ giao</CardTitle>
                    <CardDescription>
                      Đơn hàng đang chờ nhà cung cấp giao hàng
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
                      <Button onClick={handleExportExcel} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Xuất Excel Thêm SP
                      </Button>
                      <Button onClick={handleExportPurchaseExcel} variant="default" size="sm">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Xuất Excel Mua Hàng
                      </Button>
                    </div>
                  </div>
                )}

                {/* Regular export actions */}
                {selectedOrders.length > 0 && (
                  <div className="flex gap-2">
                    <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      Xuất Excel Thêm SP
                    </Button>
                    <Button onClick={handleExportPurchaseExcel} variant="default" className="gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Xuất Excel Mua Hàng
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
            {isAwaitingDeliveryLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <PurchaseOrderList
                filteredOrders={filteredAwaitingDeliveryOrders}
                isLoading={false}
                searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter="pending"
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
            )}
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
            {isDraftLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <PurchaseOrderList
                filteredOrders={filteredDraftOrders}
                isLoading={false}
                searchTerm={searchTermDraft}
                setSearchTerm={setSearchTermDraft}
                statusFilter="all"
                setStatusFilter={() => {}}
                dateFrom={dateFromDraft}
                setDateFrom={setDateFromDraft}
                dateTo={dateToDraft}
                setDateTo={setDateToDraft}
                quickFilter={quickFilterDraft}
                applyQuickFilter={applyQuickFilterDraft}
                selectedOrders={[]}
                onToggleSelect={() => {}}
                onToggleSelectAll={() => {}}
                onEditDraft={handleEditDraft}
                hideStatusFilter={true}
              />
            )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      <CreatePurchaseOrderDialog 
        open={isCreateDialogOpen}
        onOpenChange={handleCloseCreateDialog}
        initialData={draftToEdit}
      />

    </div>
  );
};

export default PurchaseOrders;