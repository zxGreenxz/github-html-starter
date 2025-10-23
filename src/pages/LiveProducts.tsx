import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
import { EditLiveSessionDialog } from "@/components/live-products/EditLiveSessionDialog";
import { AddProductToLiveDialog } from "@/components/live-products/AddProductToLiveDialog";
import { SelectProductFromInventoryDialog } from "@/components/live-products/SelectProductFromInventoryDialog";
import { FacebookPageVideoSelector } from "@/components/live-products/FacebookPageVideoSelector";
import { EditProductDialog } from "@/components/live-products/EditProductDialog";
import { EditOrderItemDialog } from "@/components/live-products/EditOrderItemDialog";
import { QuickAddOrder } from "@/components/live-products/QuickAddOrder";
import { UploadLiveOrdersToTPOSDialog } from "@/components/live-products/UploadLiveOrdersToTPOSDialog";
import { LiveSessionStats } from "@/components/live-products/LiveSessionStats";
import { LiveSupplierStats } from "@/components/live-products/LiveSupplierStats";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { Plus, Calendar, Package, ShoppingCart, Trash2, ChevronDown, ChevronRight, Edit, ListOrdered, Pencil, Copy, AlertTriangle, RefreshCw, Download, CheckCircle, Store, Search, MessageSquare, ShoppingBag, Upload, Printer, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { generateOrderImage } from "@/lib/order-image-generator";
import { getProductImageUrl } from "@/lib/tpos-image-loader";
import { formatVariant, getVariantName } from "@/lib/variant-utils";
import { ZoomableImage } from "@/components/products/ZoomableImage";
import { ProductImage } from "@/components/products/ProductImage";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Client-side multi-keyword product filter
 * - Single keyword: search in product_code, product_name, variant
 * - Multiple keywords: ALL must be in product_name
 */
const filterProductsBySearch = <T extends {
  product_code: string;
  product_name: string;
  variant?: string | null;
},>(products: T[], searchTerm: string): T[] => {
  if (!searchTerm.trim()) return products;
  const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 1) {
    // Single keyword: OR search across fields
    const searchLower = keywords[0].toLowerCase();
    return products.filter(product => product.product_code.toLowerCase().includes(searchLower) || product.product_name.toLowerCase().includes(searchLower) || (product.variant?.toLowerCase() || "").includes(searchLower));
  } else {
    // Multiple keywords: ALL must be in product_name
    return products.filter(product => {
      const nameLower = product.product_name.toLowerCase();
      return keywords.every(keyword => nameLower.includes(keyword.toLowerCase()));
    });
  }
};
interface LiveSession {
  id: string;
  session_date: string;
  supplier_name: string;
  session_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}
interface LivePhase {
  id: string;
  live_session_id: string;
  phase_date: string;
  phase_type: string;
  status: string;
  created_at: string;
}
interface LiveProduct {
  id: string;
  live_session_id: string;
  live_phase_id?: string;
  product_code: string;
  product_name: string;
  variant?: string | null;
  base_product_code?: string | null;
  prepared_quantity: number;
  sold_quantity: number;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  note?: string | null;
  product_type?: 'hang_dat' | 'hang_le' | 'hang_so_luong';
}
interface UploadHistoryEntry {
  timestamp: string;
  status: 'success' | 'failed';
  tpos_order_id?: string;
  message?: string;
}
interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  session_index: number;
  tpos_order_id?: string | null;
  code_tpos_order_id?: string | null;
  quantity: number;
  order_date: string;
  is_oversell?: boolean;
  uploaded_at?: string | null;
  upload_status?: string | null;
  customer_status?: string;
  upload_history?: UploadHistoryEntry[] | null;
}
interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
  customer_status?: string;
  note?: string | null;
  facebook_comment_id?: string | null;
  comment?: string | null;
  created_time?: string | null;
}

// Helper function to calculate oversell status dynamically
const calculateIsOversell = (productId: string, currentOrderId: string, liveProducts: LiveProduct[], ordersWithProducts: OrderWithProduct[]): boolean => {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return false;
  const productOrders = ordersWithProducts.filter(order => order.live_product_id === productId);

  // Sort orders by order date to get chronological order
  const sortedOrders = [...productOrders].sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  // Calculate cumulative quantity up to and including the current order
  let cumulativeQuantity = 0;
  let foundCurrentOrder = false;
  for (const order of sortedOrders) {
    cumulativeQuantity += order.quantity;
    if (order.id === currentOrderId) {
      foundCurrentOrder = true;
      // Current order is oversell if cumulative quantity exceeds prepared quantity
      return cumulativeQuantity > product.prepared_quantity;
    }
  }

  // If current order not found, check if total exceeds prepared quantity
  return cumulativeQuantity > product.prepared_quantity;
};

// Helper function to get highest priority customer_status from orders array
const getHighestPriorityCustomerStatus = (orders: OrderWithProduct[]): string => {
  if (!orders || orders.length === 0) return 'normal';

  // Check for bom_hang first (highest priority)
  if (orders.some(order => order.customer_status === 'bom_hang')) {
    return 'bom_hang';
  }

  // Check for thieu_thong_tin (medium priority)
  if (orders.some(order => order.customer_status === 'thieu_thong_tin')) {
    return 'thieu_thong_tin';
  }

  // Default to normal
  return 'normal';
};
export default function LiveProducts() {
  const isMobile = useIsMobile();

  // Initialize states from localStorage
  const [selectedSession, setSelectedSession] = useState<string>(() => {
    return localStorage.getItem('liveProducts_selectedSession') || "";
  });
  const [selectedPhase, setSelectedPhase] = useState<string>(() => {
    return localStorage.getItem('liveProducts_selectedPhase') || "";
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('liveProducts_activeTab') || "products";
  });

  // Removed productUpdates state - now using updated_at from database

  // Auto-print toggle state - persist in localStorage
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(() => {
    const saved = localStorage.getItem('liveProducts_autoPrintEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Effect to save auto-print state to localStorage
  useEffect(() => {
    localStorage.setItem('liveProducts_autoPrintEnabled', JSON.stringify(isAutoPrintEnabled));
  }, [isAutoPrintEnabled]);

  const productListRef = useRef<HTMLDivElement>(null);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isSessionCardCollapsed, setIsSessionCardCollapsed] = useState(false);
  const [isSelectFromInventoryOpen, setIsSelectFromInventoryOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    product_code: string;
    product_name: string;
    variant?: string;
    prepared_quantity: number;
    live_phase_id?: string;
    live_session_id?: string;
    image_url?: string;
  } | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [isEditOrderItemOpen, setIsEditOrderItemOpen] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [copyTotals, setCopyTotals] = useState<Record<string, number>>({});

  // Helper function to increment order quantities when an order is added
  const handleOrderAdded = (productId: string, quantity: number) => {
    setOrderQuantities(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + quantity
    }));
  };
  const [editingOrderItem, setEditingOrderItem] = useState<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    note?: string | null;
    facebook_comment_id?: string | null;
  } | null>(null);
  const [isUploadLiveOrdersOpen, setIsUploadLiveOrdersOpen] = useState(false);

  // Search state for products tab
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const queryClient = useQueryClient();
  const {
    enabledPages,
    addScannedBarcode
  } = useBarcodeScanner();

  // New mutation for updating prepared_quantity
  const updatePreparedQuantityMutation = useMutation({
    mutationFn: async ({
      productId,
      newQuantity
    }: {
      productId: string;
      newQuantity: number;
    }) => {
      const {
        error
      } = await supabase.from("live_products").update({
        prepared_quantity: newQuantity
      }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-products", selectedPhase, selectedSession]
      });
      toast.success("Đã cập nhật số lượng chuẩn bị");
    },
    onError: error => {
      console.error("Error updating prepared quantity:", error);
      toast.error("Lỗi cập nhật số lượng chuẩn bị: " + error.message);
    }
  });

  // Fetch live sessions
  const {
    data: liveSessions = [],
    isLoading
  } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const perfStart = performance.now();
      console.log("⚡ [PERF] Fetching live-sessions...");
      
      const {
        data,
        error
      } = await supabase.from("live_sessions").select("*").order("session_date", {
        ascending: false
      });
      if (error) throw error;
      
      console.log(`✅ [PERF] live-sessions fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
      return data as LiveSession[];
    },
    staleTime: 60000, // 60s - sessions rarely change
  });

  // Fetch live phases for selected session
  const {
    data: livePhases = []
  } = useQuery({
    queryKey: ["live-phases", selectedSession],
    queryFn: async () => {
      const perfStart = performance.now();
      console.log("⚡ [PERF] Fetching live-phases...");
      
      if (!selectedSession) return [];
      const {
        data,
        error
      } = await supabase.from("live_phases").select("*").eq("live_session_id", selectedSession).order("phase_date", {
        ascending: true
      }).order("phase_type", {
        ascending: true
      });
      if (error) throw error;
      
      console.log(`✅ [PERF] live-phases fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
      return data as LivePhase[];
    },
    enabled: !!selectedSession,
    staleTime: 30000, // 30s - phases change infrequently, realtime handles updates
  });

  // ✅ Fetch session data with facebook_post_id (cached at parent level)
  const { data: sessionData } = useQuery({
    queryKey: ['live-session-data', selectedSession],
    queryFn: async () => {
      if (!selectedSession) return null;
      
      const { data, error } = await supabase
        .from('live_sessions')
        .select('facebook_post_id, supplier_name')
        .eq('id', selectedSession)
        .single();
      
      if (error) throw error;
      
      console.log('✅ [CACHE] Loaded facebook_post_id for session:', data?.facebook_post_id);
      return data;
    },
    enabled: !!selectedSession,
    staleTime: Infinity, // Cache permanently - session data doesn't change during session
  });

  // Fetch live products for selected phase (or all phases if "all" selected)
  const {
    data: allLiveProducts = []
  } = useQuery({
    queryKey: ["live-products", selectedPhase, selectedSession],
    queryFn: async () => {
      const perfStart = performance.now();
      console.log("⚡ [PERF] Fetching live-products...");
      
      if (!selectedPhase) return [];
      if (selectedPhase === "all") {
        // Fetch all products for the session
        const {
          data,
          error
        } = await supabase.from("live_products").select("*").eq("live_session_id", selectedSession).order("updated_at", {
          ascending: false
        });
        if (error) throw error;

        // Aggregate products by product_code
        const aggregated = (data as LiveProduct[]).reduce((acc, product) => {
          if (!acc[product.product_code]) {
            acc[product.product_code] = {
              id: product.id,
              // Keep first id for reference
              live_session_id: product.live_session_id,
              live_phase_id: product.live_phase_id,
              product_code: product.product_code,
              product_name: product.product_name,
              prepared_quantity: 0,
              sold_quantity: 0,
              updated_at: product.updated_at,
            };
          }

          // Track latest updated_at for the aggregated product
          const currentUpdatedAt = new Date(product.updated_at || 0).getTime();
          const latestUpdatedAt = new Date(acc[product.product_code].updated_at || 0).getTime();
          if (currentUpdatedAt > latestUpdatedAt) {
            acc[product.product_code].updated_at = product.updated_at;
          }

          // Sum quantities
          acc[product.product_code].prepared_quantity += product.prepared_quantity;
          acc[product.product_code].sold_quantity += product.sold_quantity;
          return acc;
        }, {} as Record<string, LiveProduct>);
        
        console.log(`✅ [PERF] live-products fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
        return Object.values(aggregated);
      } else {
        // Fetch products for single phase
        const {
          data,
          error
        } = await supabase.from("live_products").select("*").eq("live_phase_id", selectedPhase).order("updated_at", {
          ascending: false
        }).order("product_code", {
          ascending: true
        }).order("variant", {
          ascending: true
        });
        if (error) throw error;
        
        console.log(`✅ [PERF] live-products fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
        return data as LiveProduct[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
    staleTime: 30000, // 30s - products update frequently but realtime handles changes
  });

  // Fetch product details from products table for images
  const { data: productsDetails = [] } = useQuery({
    queryKey: ["products-details-for-live", selectedPhase, selectedSession],
    queryFn: async () => {
      if (allLiveProducts.length === 0) return [];
      
      const productCodes = [...new Set(allLiveProducts.map(p => p.product_code))];
      
      const { data, error } = await supabase
        .from("products")
        .select("product_code, product_images, tpos_image_url, tpos_product_id, base_product_code")
        .in("product_code", productCodes);
      
      if (error) throw error;
      return data || [];
    },
    enabled: allLiveProducts.length > 0,
    staleTime: 60000, // 60s - product images rarely change
  });

  // Create a map for quick lookup with stable dependency
  const productsDetailsMap = useMemo(() => {
    const stableKey = productsDetails.map(p => p.product_code).sort().join(',');
    return new Map(productsDetails.map(p => [p.product_code, p]));
  }, [productsDetails.map(p => p.product_code).sort().join(',')]);

  // State to manage prepared quantities in the input fields
  const [preparedQuantities, setPreparedQuantities] = useState<Record<string, number>>({});
  const handlePreparedQuantityChange = (productId: string, value: string) => {
    const newQuantity = parseInt(value);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      setPreparedQuantities(prev => ({
        ...prev,
        [productId]: newQuantity
      }));
    } else if (value === "") {
      // Allow empty string for user to clear input
      setPreparedQuantities(prev => ({
        ...prev,
        [productId]: 0 // Or keep it as empty string if preferred for UX
      }));
    }
  };

  // Effect to initialize preparedQuantities when liveProducts changes
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    allLiveProducts.forEach(product => {
      initialQuantities[product.id] = product.prepared_quantity;
    });
    setPreparedQuantities(initialQuantities);
  }, [allLiveProducts]);

  // Filter products by type - stable intermediate values
  const liveProducts = useMemo(() => 
    allLiveProducts.filter(p => !p.product_type || p.product_type === 'hang_dat'), 
    [allLiveProducts]
  );
  const productsHangDat = useMemo(() => liveProducts, [liveProducts]);
  const productsHangLe = useMemo(() => 
    allLiveProducts.filter(p => p.product_type === 'hang_le'), 
    [allLiveProducts]
  );

  // Memoized filtered products - single pass filtering
  const filteredProductsHangDat = useMemo(() => 
    filterProductsBySearch(productsHangDat, debouncedProductSearch), 
    [productsHangDat, debouncedProductSearch]
  );
  const filteredProductsHangLe = useMemo(() => 
    filterProductsBySearch(productsHangLe, debouncedProductSearch), 
    [productsHangLe, debouncedProductSearch]
  );
  const filteredLiveProducts = useMemo(() => 
    filterProductsBySearch(liveProducts, debouncedProductSearch), 
    [liveProducts, debouncedProductSearch]
  );

  // Barcode scanner listener - chỉ hoạt động khi enabledPages bao gồm 'live-products'
  useEffect(() => {
    if (!enabledPages.includes('live-products')) return;
    const handleBarcodeScanned = async (event: CustomEvent) => {
      const code = event.detail.code;

      // Kiểm tra xem có session và phase được chọn không
      if (!selectedSession || !selectedPhase || selectedPhase === 'all') {
        toast.error("Vui lòng chọn session và phase cụ thể để thêm sản phẩm");
        return;
      }
      try {
        // 1. Tìm sản phẩm được quét (lấy cả product_name để kiểm tra)
        const {
          data: scannedProduct,
          error: productError
        } = await supabase.from("products").select("*").eq("product_code", code.trim()).maybeSingle();
        if (productError) throw productError;
        if (!scannedProduct) {
          toast.error(`Không tìm thấy sản phẩm: ${code}`);
          return;
        }

        let productsToAdd = [];

        // 2. Kiểm tra xem tên sản phẩm có dấu "-" không
        if (scannedProduct.product_name.includes('-')) {
          // CASE 1: Tên có dấu "-" → Split và tìm theo tên
          // Ưu tiên split theo ' - ' (với space) nếu có, fallback về '-' nếu không
          const baseNamePrefix = scannedProduct.product_name.includes(' - ') ? scannedProduct.product_name.split(' - ')[0].trim() : scannedProduct.product_name.split('-')[0].trim();
          const {
            data: matchingProducts,
            error: matchError
          } = await supabase.from("products").select("*").ilike("product_name", `${baseNamePrefix}%`);
          if (matchError) throw matchError;
          productsToAdd = matchingProducts || [];
        } else {
          // CASE 2: Không có "-" → Dùng base_product_code như cũ
          const baseCode = scannedProduct.base_product_code || scannedProduct.product_code;

          // Lấy TẤT CẢ biến thể (loại trừ sản phẩm gốc mặc định)
          const {
            data: variants,
            error: variantsError
          } = await supabase.from("products").select("*").eq("base_product_code", baseCode).not("variant", "is", null).neq("variant", "").neq("product_code", baseCode);
          if (variantsError) throw variantsError;

          // Nếu không tìm thấy biến thể, sử dụng chính sản phẩm được quét
          productsToAdd = variants && variants.length > 0 ? variants : [scannedProduct];
        }
        if (productsToAdd.length === 0) {
          toast.error("Không tìm thấy sản phẩm hoặc biến thể nào");
          return;
        }

        // Add ALL variants to BarcodeScannerContext for display in FacebookComments
        for (const product of productsToAdd) {
          addScannedBarcode({
            code: product.product_code,
            timestamp: new Date().toISOString(),
            productInfo: {
              id: product.id,
              name: product.product_name,
              image_url: getProductImageUrl(product.product_images, product.tpos_image_url),
              product_code: product.product_code
            }
          });
        }

        // 4. Kiểm tra tất cả biến thể đã có trong live_products chưa
        const variantCodes = productsToAdd.map(v => v.product_code);
        const {
          data: existingProducts,
          error: existingError
        } = await supabase.from("live_products").select("id, product_code, prepared_quantity").eq("live_phase_id", selectedPhase).in("product_code", variantCodes);
        if (existingError) throw existingError;
        const existingMap = new Map((existingProducts || []).map(p => [p.product_code, p]));

        // 5. Chuẩn bị batch insert và update
        const toInsert = [];
        const toUpdate = [];
        for (const variant of productsToAdd) {
          const existing = existingMap.get(variant.product_code);
          if (existing) {
            // Đẩy lên đầu bằng cách update created_at
            toUpdate.push({
              id: existing.id,
              created_at: new Date().toISOString()
            });
          } else {
            // Thêm mới
            toInsert.push({
              live_session_id: selectedSession,
              live_phase_id: selectedPhase,
              product_code: variant.product_code,
              product_name: variant.product_name,
              variant: formatVariant(variant.variant, variant.product_code),
              base_product_code: variant.base_product_code,
              prepared_quantity: 1,
              sold_quantity: 0,
              image_url: getProductImageUrl(variant.product_images, variant.tpos_image_url),
              product_type: 'hang_dat'
            });
          }
        }

        // ✅ 6. Thực hiện batch operations IN PARALLEL
        const perfStart = performance.now();
        console.log("⚡ [PERF] Barcode: batch operations starting...", {
          toInsert: toInsert.length,
          toUpdate: toUpdate.length
        });
        
        await Promise.all([
          // Insert all new products
          toInsert.length > 0 
            ? supabase.from("live_products").insert(toInsert)
            : Promise.resolve({ error: null }),
          
          // Update all existing products IN PARALLEL
          ...toUpdate.map(update => 
            supabase
              .from("live_products")
              .update({ created_at: update.created_at })
              .eq("id", update.id)
          )
        ]).then(results => {
          // Check for errors
          const errors = results.filter(r => r.error);
          if (errors.length > 0) {
            throw errors[0].error;
          }
        });
        
        console.log(`✅ [PERF] Barcode: batch operations done in ${(performance.now() - perfStart).toFixed(0)}ms`);

        // 7. Toast thông báo với format mới
        const insertedCount = toInsert.length;
        const updatedCount = toUpdate.length;

        // Lấy thông tin sản phẩm gốc
        const baseProductCode = productsToAdd[0]?.base_product_code || productsToAdd[0]?.product_code.split('X')[0];
        const baseProductName = productsToAdd[0]?.product_name;
        const allVariantCodes = productsToAdd.map(v => v.product_code).join(", ");
        const message = `Đã thêm ${baseProductCode} ${baseProductName} (${allVariantCodes})`;
        toast.success(message);

        // 8. Broadcast message to all users
        const {
          data: currentUserData
        } = await supabase.auth.getUser();
        const currentUserId = currentUserData.user?.id;
        const broadcastChannel = supabase.channel(`live-session-${selectedSession}`);
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'barcode-scanned',
          payload: {
            message: message,
            scannedBy: currentUserId,
            timestamp: new Date().toISOString()
          }
        });

        // 9. Refresh data
        queryClient.invalidateQueries({
          queryKey: ["live-products", selectedPhase, selectedSession]
        });
      } catch (error: any) {
        console.error("Barcode add product error:", error);
        toast.error("Lỗi thêm sản phẩm: " + error.message);
      }
    };
    window.addEventListener('barcode-scanned' as any, handleBarcodeScanned as any);
    return () => {
      window.removeEventListener('barcode-scanned' as any, handleBarcodeScanned as any);
    };
  }, [enabledPages, selectedSession, selectedPhase, queryClient]);

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('liveProducts_selectedSession', selectedSession);
  }, [selectedSession]);
  useEffect(() => {
    localStorage.setItem('liveProducts_selectedPhase', selectedPhase);
  }, [selectedPhase]);
  useEffect(() => {
    localStorage.setItem('liveProducts_activeTab', activeTab);
  }, [activeTab]);

  // Removed old product updates cleanup - now using updated_at from database

  // Helper function to get color based on copy status
  const getCopyStatusColor = (copyCount: number, soldQuantity: number) => {
    if (copyCount < soldQuantity) return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950";
    if (copyCount === soldQuantity) return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
  };

  // Fetch live orders for selected phase (or all phases if "all" selected)
  const {
    data: liveOrders = []
  } = useQuery({
    queryKey: ["live-orders", selectedPhase, selectedSession],
    queryFn: async () => {
      const perfStart = performance.now();
      console.log("⚡ [PERF] Fetching live-orders...");
      
      if (!selectedPhase) return [];
      if (selectedPhase === "all") {
        // Fetch all orders for the session
        const {
          data,
          error
        } = await supabase.from("live_orders").select("*").eq("live_session_id", selectedSession).order("created_at", {
          ascending: false
        });
        if (error) throw error;
        
        console.log(`✅ [PERF] live-orders fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
        return data as LiveOrder[];
      } else {
        const {
          data,
          error
        } = await supabase.from("live_orders").select("*").eq("live_phase_id", selectedPhase).order("created_at", {
          ascending: false
        });
        if (error) throw error;
        
        console.log(`✅ [PERF] live-orders fetched in ${(performance.now() - perfStart).toFixed(0)}ms`);
        return data as LiveOrder[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
    staleTime: 10000, // 10s - orders update frequently but realtime handles changes
  });

  // Fetch orders with product details for selected phase (or all phases if "all" selected)
  const {
    data: ordersWithProducts = []
  } = useQuery({
    queryKey: ["orders-with-products", selectedPhase, selectedSession],
    queryFn: async () => {
      const perfStart = performance.now();
      console.log("⚡ [PERF] Fetching orders-with-products (PARALLEL)...");
      
      if (!selectedPhase) return [];
      
      // ✅ OPTIMIZATION: Fetch orders and comments IN PARALLEL with Promise.all
      const [ordersData, commentsData] = await Promise.all([
        // Query 1: Fetch orders with product info
        (async () => {
          let ordersQuery = supabase
            .from("live_orders")
            .select(`
              *,
              live_products (
                product_code,
                product_name
              )
            `);
          
          if (selectedPhase === "all") {
            ordersQuery = ordersQuery.eq("live_session_id", selectedSession);
          } else {
            ordersQuery = ordersQuery.eq("live_phase_id", selectedPhase);
          }
          
          const { data, error } = await ordersQuery;
          if (error) throw error;
          return data || [];
        })(),
        
        // Query 2: Fetch ALL comments for this phase/session (in parallel!)
        (async () => {
          // First get all facebook_comment_ids to know what to fetch
          let commentIdsQuery = supabase
            .from("live_orders")
            .select("facebook_comment_id");
          
          if (selectedPhase === "all") {
            commentIdsQuery = commentIdsQuery.eq("live_session_id", selectedSession);
          } else {
            commentIdsQuery = commentIdsQuery.eq("live_phase_id", selectedPhase);
          }
          
          const { data: orderCommentIds } = await commentIdsQuery;
          const commentIds = (orderCommentIds || [])
            .map(o => o.facebook_comment_id)
            .filter(Boolean) as string[];
          
          if (commentIds.length === 0) return [];
          
          const { data, error } = await supabase
            .from('facebook_pending_orders')
            .select('facebook_comment_id, comment, created_time')
            .in('facebook_comment_id', commentIds);
          
          if (error) throw error;
          return data || [];
        })()
      ]);
      
      console.log(`✅ [PERF] orders-with-products fetched in ${(performance.now() - perfStart).toFixed(0)}ms (parallel!)`);
      
      if (!ordersData || ordersData.length === 0) return [];
      
      // Sort orders by created_at (oldest first)
      const sortedOrdersData = [...ordersData].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      
      // Create comments map
      const commentsMap = new Map<string, { comment: string; created_time: string }>();
      commentsData.forEach(item => {
        if (item.facebook_comment_id) {
          commentsMap.set(item.facebook_comment_id, {
            comment: item.comment || "",
            created_time: item.created_time || ""
          });
        }
      });
      
      // Merge data
      return sortedOrdersData.map(order => {
        const commentData = order.facebook_comment_id 
          ? commentsMap.get(order.facebook_comment_id) 
          : null;
        
        return {
          ...order,
          product_code: order.live_products?.product_code || "",
          product_name: order.live_products?.product_name || "",
          comment: commentData?.comment || null,
          created_time: commentData?.created_time || null
        };
      }) as OrderWithProduct[];
    },
    enabled: !!selectedPhase && !!selectedSession,
    staleTime: 30000, // 30s - realtime handles changes, reduce unnecessary refetches
  });

  // Fetch "Hàng Lẻ" comments from facebook_pending_orders
  const {
    data: hangLeComments = [],
    isLoading: isLoadingHangLeComments,
  } = useQuery({
    queryKey: ["hang-le-comments", selectedPhase],
    queryFn: async () => {
      console.log("Fetching hang_le comments for phase:", selectedPhase);
      
      if (!selectedPhase || selectedPhase === "all") {
        // If no phase selected or "all" selected, fetch all comments
        const { data, error } = await supabase
          .from("facebook_pending_orders" as any)
          .select("*")
          .eq("comment_type", "hang_le")
          .order("created_time", { ascending: false });
        
        if (error) {
          console.error("Error fetching hang_le comments:", error);
          throw error;
        }
        
        console.log("Fetched all hang_le comments:", data?.length || 0, "records");
        return data || [];
      }

      // Get the selected phase details
      const selectedPhaseData = livePhases.find(p => p.id === selectedPhase);
      if (!selectedPhaseData) {
        console.log("Phase not found");
        return [];
      }

      const phaseDate = new Date(selectedPhaseData.phase_date);
      const isMorning = selectedPhaseData.phase_type === 'morning';
      
      // Set start and end times based on phase type
      const startDateTime = new Date(phaseDate);
      startDateTime.setHours(isMorning ? 0 : 12, 0, 0, 0);
      
      const endDateTime = new Date(phaseDate);
      endDateTime.setHours(isMorning ? 11 : 23, isMorning ? 59 : 59, 59, 999);
      
      console.log("Filtering comments between:", startDateTime.toISOString(), "and", endDateTime.toISOString());
      
      const { data, error } = await supabase
        .from("facebook_pending_orders" as any)
        .select("*")
        .eq("comment_type", "hang_le")
        .gte("created_time", startDateTime.toISOString())
        .lte("created_time", endDateTime.toISOString())
        .order("created_time", { ascending: false });
      
      if (error) {
        console.error("Error fetching hang_le comments:", error);
        throw error;
      }
      
      console.log("Fetched hang_le comments:", data?.length || 0, "records for selected phase");
      return data || [];
    },
    enabled: true,
    staleTime: 5000, // 5s - comments change frequently
  });

  // State for managing product codes for hang le comments
  const [hangLeProductCodes, setHangLeProductCodes] = useState<Record<string, string>>({});

  // Mutation to update product code for a hang le comment
  const updateHangLeProductCodeMutation = useMutation({
    mutationFn: async ({ commentId, productCode }: { commentId: string; productCode: string }) => {
      // Verify product exists
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, product_code, product_name")
        .eq("product_code", productCode.trim())
        .maybeSingle();

      if (productError) throw productError;
      if (!product) throw new Error(`Không tìm thấy sản phẩm: ${productCode}`);

      // Update the pending order with product code
      const { error } = await supabase
        .from("facebook_pending_orders" as any)
        .update({ 
          product_code: productCode.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", commentId);

      if (error) throw error;

      return { product, commentId };
    },
    onSuccess: (data) => {
      toast.success(`Đã gắn mã sản phẩm: ${data.product.product_code}`);
      queryClient.invalidateQueries({ queryKey: ["hang-le-comments", selectedPhase] });
      // Clear the input field
      setHangLeProductCodes(prev => ({
        ...prev,
        [data.commentId]: ""
      }));
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`);
    }
  });

  // ✅ PERFORMANCE MONITORING: Track total page load time
  useEffect(() => {
    const loadStart = performance.now();
    console.log("📊 [PERF MONITOR] LiveProducts page load started");
    
    // Check if all queries are done loading
    const allQueriesLoaded = !isLoading && 
      !!selectedSession && 
      !!selectedPhase &&
      allLiveProducts !== undefined &&
      liveOrders !== undefined &&
      ordersWithProducts !== undefined;
    
    if (allQueriesLoaded) {
      const loadTime = performance.now() - loadStart;
      console.log(`✅ [PERF MONITOR] All queries loaded in ${loadTime.toFixed(0)}ms`);
      console.log(`📊 [PERF SUMMARY] Data loaded:`, {
        sessions: liveSessions.length,
        phases: livePhases.length,
        products: allLiveProducts.length,
        orders: liveOrders.length,
        ordersWithProducts: ordersWithProducts.length,
        hangLeComments: hangLeComments.length
      });
    }
  }, [isLoading, selectedSession, selectedPhase, allLiveProducts, liveOrders, ordersWithProducts, liveSessions, livePhases, hangLeComments]);

  // Debounced invalidate to batch multiple realtime updates
  const debouncedInvalidate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      const pending = new Set<string>();
      
      return (queryKey: string) => {
        pending.add(queryKey);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        timeoutId = setTimeout(() => {
          pending.forEach(key => {
            if (key === 'live-sessions') {
              queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
            } else if (key === 'live-phases') {
              queryClient.invalidateQueries({ queryKey: ["live-phases", selectedSession] });
            } else if (key === 'live-products') {
              queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase, selectedSession] });
            } else if (key === 'live-orders') {
              queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase, selectedSession] });
              queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase, selectedSession] });
            }
          });
          pending.clear();
        }, 300); // 300ms debounce
      };
    })(),
    [queryClient, selectedSession, selectedPhase]
  );

  // Real-time subscriptions with debouncing
  useEffect(() => {
    if (!selectedSession || !selectedPhase) return;
    
    const channel = supabase
      .channel('live-products-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_sessions'
      }, () => {
        debouncedInvalidate('live-sessions');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_phases',
        filter: `live_session_id=eq.${selectedSession}`
      }, () => {
        debouncedInvalidate('live-phases');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_products',
        filter: `live_session_id=eq.${selectedSession}`
      }, () => {
        debouncedInvalidate('live-products');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_orders',
        filter: `live_session_id=eq.${selectedSession}`
      }, () => {
        debouncedInvalidate('live-orders');
      })
      .subscribe();

    // Subscribe to broadcast channel for barcode scanned notifications
    const broadcastChannel = supabase
      .channel(`live-session-${selectedSession}`)
      .on('broadcast', {
        event: 'barcode-scanned'
      }, async (payload: any) => {
        const { data: currentUserData } = await supabase.auth.getUser();
        const currentUserId = currentUserData.user?.id;

        // Chỉ hiện toast nếu KHÔNG phải người quét
        if (payload.payload.scannedBy !== currentUserId) {
          toast.success(payload.payload.message);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [selectedSession, selectedPhase, debouncedInvalidate, queryClient]);

  // Delete order item mutation (delete single product from order)
  const deleteOrderItemMutation = useMutation({
    mutationFn: async ({
      orderId,
      productId,
      quantity
    }: {
      orderId: string;
      productId: string;
      quantity: number;
    }) => {
      // Update product sold quantity first
      const {
        data: product,
        error: productFetchError
      } = await supabase.from("live_products").select("sold_quantity").eq("id", productId).single();
      if (productFetchError) throw productFetchError;
      const {
        error: updateError
      } = await supabase.from("live_products").update({
        sold_quantity: Math.max(0, product.sold_quantity - quantity)
      }).eq("id", productId);
      if (updateError) throw updateError;

      // Delete the order item
      const {
        error
      } = await supabase.from("live_orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-orders", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-products", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders-with-products", selectedPhase]
      });
      toast.success("Đã xóa sản phẩm khỏi đơn hàng");
    },
    onError: error => {
      console.error("Error deleting order item:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    }
  });

  // Delete product mutation (cascading delete orders)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // First delete all orders for this product
      const {
        error: deleteOrdersError
      } = await supabase.from("live_orders").delete().eq("live_product_id", productId);
      if (deleteOrdersError) throw deleteOrdersError;

      // Then delete the product
      const {
        error
      } = await supabase.from("live_products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-products", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-orders", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders-with-products", selectedPhase]
      });
      toast.success("Đã xóa sản phẩm và các đơn hàng liên quan thành công");
    },
    onError: error => {
      console.error("Error deleting product:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    }
  });

  // Delete all variants of a product (by product_code)
  const deleteAllVariantsMutation = useMutation({
    mutationFn: async ({
      product_code,
      live_phase_id,
      live_session_id
    }: {
      product_code: string;
      live_phase_id: string | null;
      live_session_id: string;
    }) => {
      // Get all products with this product_code in the session
      let query = supabase.from("live_products").select("id").eq("product_code", product_code).eq("live_session_id", live_session_id);
      if (live_phase_id) {
        query = query.eq("live_phase_id", live_phase_id);
      }
      const {
        data: productsToDelete,
        error: fetchError
      } = await query;
      if (fetchError) throw fetchError;
      if (!productsToDelete || productsToDelete.length === 0) return;
      const productIds = productsToDelete.map(p => p.id);

      // First delete all orders for these products
      const {
        error: deleteOrdersError
      } = await supabase.from("live_orders").delete().in("live_product_id", productIds);
      if (deleteOrdersError) throw deleteOrdersError;

      // Then delete all the products
      const {
        error: deleteProductsError
      } = await supabase.from("live_products").delete().in("id", productIds);
      if (deleteProductsError) throw deleteProductsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-products", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-orders", selectedPhase]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders-with-products", selectedPhase]
      });
      toast.success("Đã xóa toàn bộ sản phẩm và các đơn hàng liên quan");
    },
    onError: error => {
      console.error("Error deleting all variants:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    }
  });

  // Delete all phases and data for a live session
  const deleteAllPhasesForSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const {
        data: phases,
        error: phasesError
      } = await supabase.from("live_phases").select("id").eq("live_session_id", sessionId);
      if (phasesError) throw phasesError;
      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const {
          error: deleteOrdersError
        } = await supabase.from("live_orders").delete().in("live_phase_id", phaseIds);
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const {
          error: deleteProductsError
        } = await supabase.from("live_products").delete().in("live_phase_id", phaseIds);
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const {
        error: deletePhasesError
      } = await supabase.from("live_phases").delete().eq("live_session_id", sessionId);
      if (deletePhasesError) throw deletePhasesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-phases"]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-products"]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-orders"]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders-with-products"]
      });
      setSelectedPhase("");
      toast.success("Đã xóa toàn bộ phiên live và dữ liệu thành công");
    },
    onError: error => {
      console.error("Error deleting all phases for session:", error);
      toast.error("Có lỗi xảy ra khi xóa phiên live");
    }
  });

  // Delete live session mutation (cascading delete products and orders)
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const {
        data: phases,
        error: phasesError
      } = await supabase.from("live_phases").select("id").eq("live_session_id", sessionId);
      if (phasesError) throw phasesError;
      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const {
          error: deleteOrdersError
        } = await supabase.from("live_orders").delete().in("live_phase_id", phaseIds);
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const {
          error: deleteProductsError
        } = await supabase.from("live_products").delete().in("live_phase_id", phaseIds);
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const {
        error: deletePhasesError
      } = await supabase.from("live_phases").delete().eq("live_session_id", sessionId);
      if (deletePhasesError) throw deletePhasesError;

      // Finally delete the session
      const {
        error
      } = await supabase.from("live_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-sessions"]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-phases"]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-products"]
      });
      queryClient.invalidateQueries({
        queryKey: ["live-orders"]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders-with-products"]
      });
      setSelectedSession("");
      setSelectedPhase("");
      toast.success("Đã xóa đợt live và tất cả dữ liệu liên quan thành công");
    },
    onError: error => {
      console.error("Error deleting live session:", error);
      toast.error("Có lỗi xảy ra khi xóa đợt live");
    }
  });
  const handleDeleteOrderItem = async (orderId: string, productId: string, quantity: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng?")) {
      await deleteOrderItemMutation.mutateAsync({
        orderId,
        productId,
        quantity
      });
    }
  };
  const handleEditOrderItem = (order: OrderWithProduct) => {
    setEditingOrderItem({
      id: order.id,
      product_id: order.live_product_id,
      product_name: order.product_name,
      quantity: order.quantity,
      note: order.note,
      facebook_comment_id: order.facebook_comment_id
    });
    setIsEditOrderItemOpen(true);
  };

  const handleDeleteSingleOrder = async (order: OrderWithProduct) => {
    if (window.confirm(`Bạn có chắc muốn xóa ${order.quantity} x ${order.product_name}?`)) {
      try {
        // Delete the order
        const { error: deleteError } = await supabase
          .from('live_orders')
          .delete()
          .eq('id', order.id);
        
        if (deleteError) throw deleteError;
        
        // Update sold_quantity
        const { data: product } = await supabase
          .from('live_products')
          .select('sold_quantity')
          .eq('id', order.live_product_id)
          .single();
        
        if (product) {
          await supabase
            .from('live_products')
            .update({ 
              sold_quantity: Math.max(0, product.sold_quantity - order.quantity) 
            })
            .eq('id', order.live_product_id);
        }
        
        toast.success("Đã xóa sản phẩm");
        queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      } catch (error: any) {
        console.error('Delete order error:', error);
        toast.error("Có lỗi xảy ra khi xóa sản phẩm");
      }
    }
  };
  const handleDeleteAllPhasesForSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ phiên live và dữ liệu của đợt này? Hành động này không thể hoàn tác.")) {
      await deleteAllPhasesForSessionMutation.mutateAsync(sessionId);
    }
  };
  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này? Tất cả đơn hàng liên quan cũng sẽ bị xóa.")) {
      await deleteProductMutation.mutateAsync(productId);
    }
  };
  const handleDeleteAllVariants = async (product_code: string, product_name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ sản phẩm "${product_name}" (${product_code}) và tất cả biến thể? Tất cả đơn hàng liên quan cũng sẽ bị xóa.`)) {
      await deleteAllVariantsMutation.mutateAsync({
        product_code,
        live_phase_id: selectedPhase === "all" ? null : selectedPhase,
        live_session_id: selectedSession
      });
    }
  };
  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đợt live này? Tất cả phiên live, sản phẩm và đơn hàng liên quan sẽ bị xóa.")) {
      await deleteSessionMutation.mutateAsync(sessionId);
    }
  };

  // Mutation chuyển sang Hàng Lẻ
  const changeToHangLeMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      // 1. Kiểm tra từng sản phẩm xem có đơn hàng không
      const {
        data: ordersData
      } = await supabase.from('live_orders').select('live_product_id').in('live_product_id', productIds);
      const productIdsWithOrders = new Set((ordersData || []).map(order => order.live_product_id));

      // 2. Chia thành 2 nhóm: có đơn và không có đơn
      const productsToConvert = productIds.filter(id => productIdsWithOrders.has(id));
      const productsToDelete = productIds.filter(id => !productIdsWithOrders.has(id));

      // 3. Chuyển sang Hàng Lẻ cho các sản phẩm có đơn
      if (productsToConvert.length > 0) {
        const {
          error: updateError
        } = await supabase.from('live_products').update({
          product_type: 'hang_le'
        }).in('id', productsToConvert);
        if (updateError) throw updateError;
      }

      // 4. Xóa các sản phẩm không có đơn
      if (productsToDelete.length > 0) {
        const {
          error: deleteError
        } = await supabase.from('live_products').delete().in('id', productsToDelete);
        if (deleteError) throw deleteError;
      }
      return {
        converted: productsToConvert.length,
        deleted: productsToDelete.length
      };
    },
    onSuccess: ({
      converted,
      deleted
    }) => {
      queryClient.invalidateQueries({
        queryKey: ['live-products']
      });
      if (converted > 0 && deleted > 0) {
        toast.success(`Đã chuyển ${converted} biến thể có đơn sang Hàng Lẻ, xóa ${deleted} biến thể không có đơn`);
      } else if (converted > 0) {
        toast.success(`Đã chuyển ${converted} biến thể sang Hàng Lẻ`);
      } else if (deleted > 0) {
        toast.success(`Đã xóa ${deleted} biến thể không có đơn`);
      } else {
        toast.info('Không có thay đổi nào');
      }
    },
    onError: error => {
      toast.error(`Lỗi: ${error.message}`);
    }
  });

  // Mutation chuyển về Hàng Đặt
  const changeToHangDatMutation = useMutation({
    mutationFn: async (productId: string) => {
      const {
        error
      } = await supabase.from('live_products').update({
        product_type: 'hang_dat'
      }).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['live-products']
      });
      toast.success('Đã chuyển về Hàng Đặt');
    },
    onError: error => {
      toast.error(`Lỗi: ${error.message}`);
    }
  });
  const handleEditProduct = (product: LiveProduct) => {
    setEditingProduct({
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      variant: product.variant || undefined,
      prepared_quantity: product.prepared_quantity,
      live_phase_id: product.live_phase_id || selectedPhase,
      live_session_id: product.live_session_id || selectedSession
    });
    setIsEditProductOpen(true);
  };
  const handleEditSession = (session: LiveSession) => {
    setEditingSession(session);
    setIsEditSessionOpen(true);
  };
  const handleRefreshProducts = () => {
    queryClient.invalidateQueries({
      queryKey: ["live-products", selectedPhase, selectedSession]
    });
    queryClient.invalidateQueries({
      queryKey: ["live-orders", selectedPhase, selectedSession]
    });
    queryClient.invalidateQueries({
      queryKey: ["orders-with-products", selectedPhase, selectedSession]
    });
    toast.success("Đã làm mới danh sách sản phẩm");
  };
  const getPhaseDisplayName = (phase: LivePhase) => {
    const date = new Date(phase.phase_date);
    const dayNumber = Math.floor((date.getTime() - new Date(livePhases[0]?.phase_date || phase.phase_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const phaseType = phase.phase_type === 'morning' ? 'Sáng' : 'Chiều';
    return `Ngày ${dayNumber} - ${phaseType} (${format(date, "dd/MM/yyyy")})`;
  };
  const getSessionDisplayName = (session: LiveSession) => {
    const sessionName = session.session_name || session.supplier_name;
    if (session.start_date && session.end_date) {
      return `${sessionName} - ${format(new Date(session.start_date), "dd/MM/yyyy")} đến ${format(new Date(session.end_date), "dd/MM/yyyy")}`;
    }
    return `${sessionName} - ${format(new Date(session.session_date), "dd/MM/yyyy")}`;
  };
  if (isLoading) {
    return <div className="container mx-auto p-6">
        <div className="text-center">Đang tải...</div>
      </div>;
  }
  return <div className="w-full px-4 space-y-6">
      {/* Header */}
      

      {/* Main content wrapper */}
      <div>
        {/* Session Selection */}
        <Card>
          {isSessionCardCollapsed ? (
            <div className="p-2 flex justify-center">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setIsSessionCardCollapsed(false)}
                className="h-12 w-12"
              >
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Chọn Đợt Live & Facebook Video</h3>
                </div>
              </CardHeader>
              <CardContent>
            {liveSessions.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Đợt Live</label>
                    <Select value={selectedSession} onValueChange={value => {
                  setSelectedSession(value);
                  setSelectedPhase(""); // Reset phase selection
                }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn một đợt live" />
                      </SelectTrigger>
                      <SelectContent>
                        {liveSessions.map(session => <SelectItem key={session.id} value={session.id}>
                            {getSessionDisplayName(session)}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSession && livePhases.length > 0 && <div>
                      <label className="text-sm font-medium mb-2 block">Phiên Live</label>
                      <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn phiên live" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="all">📊 Tất cả phiên live</SelectItem>
                          {livePhases.map(phase => <SelectItem key={phase.id} value={phase.id}>
                              {getPhaseDisplayName(phase)}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>}
                </div>

                {/* Facebook Page & Video Selector */}
                {selectedSession && sessionData && (
                  <div className="pt-4 border-t">
                    <FacebookPageVideoSelector 
                      sessionId={selectedSession}
                      currentFacebookPostId={sessionData.facebook_post_id}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Chưa có đợt live nào. Nhấn nút "Tạo đợt Live mới" để bắt đầu.
              </div>
            )}

            <div className="flex flex-col gap-3 mt-4">
              <div className="flex gap-2">
                <Button onClick={() => setIsCreateSessionOpen(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Tạo đợt Live mới
                </Button>
                {selectedSession && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => {
                      const session = liveSessions.find(s => s.id === selectedSession);
                      if (session) handleEditSession(session);
                    }} className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Chỉnh Sửa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteAllPhasesForSession(selectedSession)} className="flex items-center gap-2 text-orange-600 hover:text-orange-700">
                      <Trash2 className="h-4 w-4" />
                      Xóa toàn bộ phiên live
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSession(selectedSession)} className="flex items-center gap-2 text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                      Xóa đợt live
                    </Button>

                    {/* Auto-print toggle */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                            <Printer className={cn("h-4 w-4", isAutoPrintEnabled ? "text-green-600" : "text-gray-400")} />
                            <Switch
                              checked={isAutoPrintEnabled}
                              onCheckedChange={setIsAutoPrintEnabled}
                            />
                            <span className="text-sm font-medium">
                              {isAutoPrintEnabled ? "In tự động BẬT" : "In tự động TẮT"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật/tắt in tự động khi thêm đơn từ QuickAddOrder</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setIsSessionCardCollapsed(true)}
                  className="h-12 w-12"
                >
                  <ChevronDown className="h-6 w-6 rotate-180" />
                </Button>
              </div>
            </div>
              </CardContent>
            </>
          )}
        </Card>

      {/* Stats and Content */}
      {selectedPhase && <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div ref={tabsRef} className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Sản phẩm ({productsHangDat.length})
                </TabsTrigger>
                <TabsTrigger value="hang-le" className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Hàng Lẻ ({productsHangLe.length})
                </TabsTrigger>
                <TabsTrigger value="comment-hang-le" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comment hàng lẻ
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Đơn hàng (theo mã đơn)
                </TabsTrigger>
                <TabsTrigger value="products-orders" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  MÃ SP
                </TabsTrigger>
                 <TabsTrigger value="supplier-stats" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Thống kê NCC
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                {activeTab === "products" && (
                  <Button variant="outline" size="sm" onClick={handleRefreshProducts} disabled={liveProducts.length === 0} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Làm mới
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="products" className="space-y-4">
              {liveProducts.length === 0 ? <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có sản phẩm nào</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Thêm sản phẩm đầu tiên cho phiên live này
                    </p>
                  </CardContent>
                </Card> : <>
                  {/* Search box */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-lg border">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Tìm kiếm theo mã SP, tên sản phẩm, biến thể..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground" />
                    {productSearch && <Button variant="ghost" size="sm" onClick={() => setProductSearch("")} className="h-6 px-2">
                        Xóa
                      </Button>}
                  </div>

                  <div ref={productListRef}>
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mã SP</TableHead>
                            <TableHead>Tên sản phẩm</TableHead>
                            <TableHead>Biến Thể</TableHead>
                            <TableHead>Hình ảnh</TableHead>
                            <TableHead className="text-center w-24">Tạo order</TableHead>
                            <TableHead className="text-center">SL chuẩn bị</TableHead>
                            <TableHead className="text-center">SL đã bán</TableHead>
                            <TableHead>Mã đơn hàng</TableHead>
                            <TableHead className="text-center">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                        // Use memoized filtered products
                        const filteredProducts = filteredProductsHangDat;

                        // Group products by base_product_code (or unique key for manual products)
                        const productGroups = filteredProducts.reduce((groups, product) => {
                          // Use base_product_code for inventory items, unique key for manual items
                          const key = product.base_product_code ? product.base_product_code : `single_${product.id}`;
                          if (!groups[key]) {
                            groups[key] = {
                              product_code: product.base_product_code || product.product_code,
                              product_name: product.base_product_code ? product.product_name.split('(')[0].trim() : product.product_name,
                              products: [],
                              latest_updated_at: product.updated_at,
                              base_product_code: product.base_product_code
                            };
                          }
                          groups[key].products.push(product);
                          // Track latest updated_at for group sorting
                          if (product.updated_at && product.updated_at > groups[key].latest_updated_at!) {
                            groups[key].latest_updated_at = product.updated_at;
                          }
                          return groups;
        }, {} as Record<string, {
          product_code: string;
          product_name: string;
          products: LiveProduct[];
          latest_updated_at?: string;
          base_product_code?: string | null;
        }>);

                        // Sort groups by latest updated_at from database (newest first)
                        const sortedGroups = Object.values(productGroups).sort((a, b) => {
                          const timeA = new Date(a.latest_updated_at || 0).getTime();
                          const timeB = new Date(b.latest_updated_at || 0).getTime();
                          return timeB - timeA; // Descending: newest first
                        });
                        return sortedGroups.flatMap(group => {
                          // Sort products within group by variant name first, then by created_at
                          const sortedProducts = [...group.products].sort((a, b) => {
                            // Primary sort: variant name (alphabetically)
                            const variantA = (a.variant || '').toLowerCase();
                            const variantB = (b.variant || '').toLowerCase();
                            const variantCompare = variantA.localeCompare(variantB);
                            if (variantCompare !== 0) return variantCompare;

                            // Secondary sort: created_at (if variants are the same)
                            const timeA = new Date(a.created_at || 0).getTime();
                            const timeB = new Date(b.created_at || 0).getTime();
                            return timeA - timeB;
                          });
                          return sortedProducts.map((product, productIndex) => <TableRow key={product.id}>
                                  {productIndex === 0 && <>
                                      <TableCell rowSpan={group.products.length} className="font-medium align-top border-r">
                                        {group.product_code}
                                      </TableCell>
                                       <TableCell rowSpan={group.products.length} className="align-top border-r">
                                         {group.product_name}
                                       </TableCell>
                                     </>}
                                   <TableCell className="text-muted-foreground">
                                     {getVariantName(product.variant)}
                                   </TableCell>
                                     <TableCell className="border-r">
                                       <ProductImage
                                         productId={product.id}
                                         productCode={product.product_code}
                                         productImages={productsDetailsMap.get(product.product_code)?.product_images || null}
                                         tposImageUrl={productsDetailsMap.get(product.product_code)?.tpos_image_url || product.image_url}
                                         tposProductId={productsDetailsMap.get(product.product_code)?.tpos_product_id || null}
                                         baseProductCode={productsDetailsMap.get(product.product_code)?.base_product_code || product.base_product_code}
                                       />
                                     </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={async () => {
                                  const qty = orderQuantities[product.id] || 0;
                                  if (qty === 0) {
                                    toast.error("Số lượng phải lớn hơn 0");
                                    return;
                                  }
                                  if (!product.image_url) {
                                    toast.error("Sản phẩm chưa có hình ảnh");
                                    return;
                                  }
                                  await generateOrderImage(product.image_url, product.variant || "", qty, product.product_name);
                                  // Update copy total
                                  setCopyTotals(prev => ({
                                    ...prev,
                                    [product.id]: (prev[product.id] || 0) + qty
                                  }));
                                  // Reset orderQuantities to 0
                                  setOrderQuantities(prev => ({
                                    ...prev,
                                    [product.id]: 0
                                  }));
                                }} disabled={!product.image_url} title={product.image_url ? "Copy hình order" : "Chưa có hình ảnh"}>
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <input type="number" min="1" value={orderQuantities[product.id] || 0} onChange={e => {
                                  const value = parseInt(e.target.value) || 0;
                                  setOrderQuantities(prev => ({
                                    ...prev,
                                    [product.id]: value
                                  }));
                                }} className="w-12 h-6 text-center text-xs border rounded px-1" placeholder="SL" />
                                      {copyTotals[product.id] > 0 && <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCopyStatusColor(copyTotals[product.id], product.sold_quantity)}`}>
                                          Đã Đặt: {copyTotals[product.id]}
                                        </div>}
                                    </div>
                                  </TableCell>
                                   <TableCell className="text-center">
                                     <Input type="number" min="0" value={preparedQuantities[product.id] ?? product.prepared_quantity} onChange={e => handlePreparedQuantityChange(product.id, e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => {
                             const newQuantity = preparedQuantities[product.id];
                             if (newQuantity !== undefined && newQuantity !== product.prepared_quantity) {
                               updatePreparedQuantityMutation.mutate({
                                 productId: product.id,
                                 newQuantity
                               });
                             }
                           }} className="w-16 text-center h-8" />
                                   </TableCell>
                                  <TableCell className="text-center">{product.sold_quantity}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {(() => {
                                  const productOrders = selectedPhase === "all" ? ordersWithProducts.filter(order => order.product_code === product.product_code) : ordersWithProducts.filter(order => order.live_product_id === product.id);

                                  return <>
                                            {productOrders.map(order => {
                                      const isOversell = calculateIsOversell(order.live_product_id, order.id, liveProducts, ordersWithProducts);
                                      const badgeVariant = isOversell ? "destructive" : order.uploaded_at ? "secondary" : "default";
                                      const getCustomerStatusColor = (status?: string) => {
                                        switch (status) {
                                          case 'bom_hang':
                                            return 'bg-red-500 text-white border-red-600';
                                          case 'thieu_thong_tin':
                                            return 'bg-yellow-500 text-white border-yellow-600';
                                          default:
                                            return '';
                                        }
                                      };
                                      const customerStatusColor = getCustomerStatusColor(order.customer_status);
                                      return <TooltipProvider key={order.id}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Badge variant={badgeVariant} className={`cursor-pointer text-xs ${customerStatusColor}`} onClick={() => handleEditOrderItem(order)}>
                                                        {order.session_index}
                                                        {isOversell && " ⚠️"}
                                                        {order.uploaded_at && " ✓"}
                                                      </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <div className="text-xs">
                                                        <div>Mã: {order.session_index}</div>
                                                        <div>SL: {order.quantity}</div>
                                                        {isOversell && <div className="text-red-500 font-semibold">⚠️ Vượt số lượng chuẩn bị</div>}
                                                        {order.uploaded_at && <div className="text-green-600 font-semibold">
                                                            ✓ Đã đẩy lên TPOS {format(new Date(order.uploaded_at), 'dd/MM HH:mm', {
                                                  locale: vi
                                                })}
                                                          </div>}
                                                        {order.customer_status === 'bom_hang' && <div className="text-red-600 font-semibold">🚫 BOM HÀNG</div>}
                                                        {order.customer_status === 'thieu_thong_tin' && <div className="text-yellow-600 font-semibold">⚠️ THIẾU THÔNG TIN</div>}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>;
                                    })}
                                            {productOrders.length === 0 && <span className="text-xs text-muted-foreground">
                                                Chưa có đơn
                                              </span>}
                                            {selectedPhase !== "all" && <QuickAddOrder productId={product.id} phaseId={selectedPhase} sessionId={selectedSession} availableQuantity={product.prepared_quantity - product.sold_quantity} onOrderAdded={qty => handleOrderAdded(product.id, qty)} isAutoPrintEnabled={isAutoPrintEnabled} facebookPostId={sessionData?.facebook_post_id} />}
                                          </>;
                                })()}
                                     </div>
                                   </TableCell>
                                   <TableCell className="border-l">
                                     <div className="flex items-center gap-2 justify-center">
                                       <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)}>
                                         <Edit className="h-4 w-4" />
                                       </Button>
                                       <Button variant="ghost" size="sm" onClick={() => {
                                         if (window.confirm(`Bạn có chắc muốn xóa biến thể "${getVariantName(product.variant)}" của sản phẩm "${group.product_name}"?`)) {
                                           deleteProductMutation.mutate(product.id);
                                         }
                                       }} className="text-red-600 hover:text-red-700">
                                         <Trash2 className="h-4 w-4" />
                                       </Button>
                                     </div>
                                   </TableCell>
                                 </TableRow>);
                        });
                      })()}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                </>}
            </TabsContent>

            <TabsContent value="individual" className="space-y-4">
              {!selectedPhase ? <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-2" />
                    <p>Vui lòng chọn phiên live để xem sản phẩm</p>
                  </CardContent>
                </Card> : <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm kiếm theo mã SP, tên sản phẩm, biến thể..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleRefreshProducts} title="Làm mới">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã SP</TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead>Biến Thể</TableHead>
                        <TableHead>Hình ảnh</TableHead>
                        <TableHead className="text-center">Tạo order</TableHead>
                        <TableHead className="text-center">SL chuẩn bị</TableHead>
                        <TableHead className="text-center">SL đã bán</TableHead>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                      // Use memoized filtered products
                      const filteredProducts = filteredLiveProducts;

                      // Sort by latest updated_at from database (newest first)
                      const sortedProducts = [...filteredProducts].sort((a, b) => {
                        const timeA = new Date(a.updated_at || 0).getTime();
                        const timeB = new Date(b.updated_at || 0).getTime();
                        return timeB - timeA; // Descending: newest first
                      });
                      return sortedProducts.map(product => {
                        const productDetail = productsDetailsMap.get(product.product_code);
                        
                        return <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.product_code}</TableCell>
                            <TableCell>{product.product_name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {getVariantName(product.variant)}
                            </TableCell>
                            <TableCell>
                              <ProductImage
                                productId={product.id}
                                productCode={product.product_code}
                                productImages={productDetail?.product_images || null}
                                tposImageUrl={productDetail?.tpos_image_url || product.image_url}
                                tposProductId={productDetail?.tpos_product_id || null}
                                baseProductCode={productDetail?.base_product_code || product.base_product_code}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={async () => {
                              const qty = orderQuantities[product.id] || 0;
                              if (qty === 0) {
                                toast.error("Số lượng phải lớn hơn 0");
                                return;
                              }
                              if (!product.image_url) {
                                toast.error("Sản phẩm chưa có hình ảnh");
                                return;
                              }
                              await generateOrderImage(product.image_url, product.variant || "", qty, product.product_name);
                              setCopyTotals(prev => ({
                                ...prev,
                                [product.id]: (prev[product.id] || 0) + qty
                              }));
                              // Reset orderQuantities to 0
                              setOrderQuantities(prev => ({
                                ...prev,
                                [product.id]: 0
                              }));
                            }} disabled={!product.image_url} title={product.image_url ? "Copy hình order" : "Chưa có hình ảnh"}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                                 <input type="number" min="1" value={orderQuantities[product.id] || 0} onChange={e => {
                              const value = parseInt(e.target.value) || 0;
                              setOrderQuantities(prev => ({
                                ...prev,
                                [product.id]: value
                              }));
                            }} className="w-12 h-6 text-center text-xs border rounded px-1" placeholder="SL" />
                                {copyTotals[product.id] > 0 && <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCopyStatusColor(copyTotals[product.id], product.sold_quantity)}`}>
                                    Đã Đặt: {copyTotals[product.id]}
                                  </div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input type="number" min="0" value={preparedQuantities[product.id] ?? product.prepared_quantity} // Use local state, fallback to prop
                          onChange={e => handlePreparedQuantityChange(product.id, e.target.value)} onBlur={() => {
                            const newQuantity = preparedQuantities[product.id];
                            if (newQuantity !== undefined && newQuantity !== product.prepared_quantity) {
                              updatePreparedQuantityMutation.mutate({
                                productId: product.id,
                                newQuantity
                              });
                            }
                          }} className="w-20 text-center h-8" disabled={updatePreparedQuantityMutation.isPending} />
                            </TableCell>
                            <TableCell className="text-center">{product.sold_quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(() => {
                              const productOrders = ordersWithProducts.filter(order => order.live_product_id === product.id);
                              return <>
                                      {productOrders.map(order => {
                                  const isOversell = calculateIsOversell(order.live_product_id, order.id, liveProducts || [], ordersWithProducts);
                                  let badgeColor = "bg-blue-100 text-blue-700 hover:bg-blue-200";
                                  if (isOversell) {
                                    badgeColor = "bg-yellow-500 text-white hover:bg-yellow-600 font-bold shadow-md";
                                  } else if (order.customer_status === 'bom_hang') {
                                    badgeColor = "bg-red-600 text-white hover:bg-red-700 font-bold";
                                  } else if (order.customer_status === 'thieu_thong_tin') {
                                    badgeColor = "bg-gray-500 text-white hover:bg-gray-600";
                                  }
                                  return <TooltipProvider key={order.id}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                              <Badge variant="secondary" className={`text-xs cursor-pointer hover:scale-105 transition-transform ${badgeColor}`} onClick={() => handleEditOrderItem(order)}>
                                                {isOversell && <AlertTriangle className="h-3 w-3 mr-1" />}
                                                {order.quantity === 1 ? order.session_index : `${order.session_index} x${order.quantity}`}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>{isOversell ? "⚠️ Đơn quá số" : `Đơn: ${order.session_index} - SL: ${order.quantity}`}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>;
                                })}
                                      {selectedPhase !== "all" && <div className="flex items-center gap-2 ml-2">
                                          <QuickAddOrder productId={product.id} phaseId={selectedPhase} sessionId={selectedSession} availableQuantity={product.prepared_quantity - product.sold_quantity} onOrderAdded={qty => handleOrderAdded(product.id, qty)} isAutoPrintEnabled={isAutoPrintEnabled} facebookPostId={sessionData?.facebook_post_id} />
                                        </div>}
                                    </>;
                            })()}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} disabled={selectedPhase === "all"} title={selectedPhase === "all" ? "Chọn phiên live cụ thể để chỉnh sửa" : ""}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} disabled={selectedPhase === "all"} className="text-red-600 hover:text-red-700" title={selectedPhase === "all" ? "Chọn phiên live cụ thể để xóa" : ""}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>;
                      });
                    })()}
                    </TableBody>
                  </Table>
                </Card>
              </>}
            </TabsContent>

            {/* Hàng Lẻ Tab */}
            <TabsContent value="hang-le" className="space-y-4">
              {!selectedPhase ? <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <ShoppingBag className="mx-auto h-12 w-12 mb-4" />
                    <p>Vui lòng chọn phiên live để xem hàng lẻ</p>
                  </CardContent>
                </Card> : <>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Tìm kiếm hàng lẻ..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-10" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRefreshProducts}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã SP</TableHead>
                          <TableHead>Tên sản phẩm</TableHead>
                          <TableHead>Hình ảnh</TableHead>
                          <TableHead className="text-center">SL chuẩn bị</TableHead>
                          <TableHead className="text-center">SL đã bán</TableHead>
                          <TableHead>Mã đơn hàng</TableHead>
                          <TableHead className="text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                      const filteredHangLe = filteredProductsHangLe;
                      if (filteredHangLe.length === 0) {
                        return <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  {productSearch.trim() ? "Không tìm thấy sản phẩm" : "Chưa có hàng lẻ"}
                                </TableCell>
                              </TableRow>;
                      }
                      return filteredHangLe.map(product => {
                        const productOrders = ordersWithProducts.filter(order => order.live_product_id === product.id);
                        const productDetail = productsDetailsMap.get(product.product_code);
                        
                        return <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.product_code}</TableCell>
                                <TableCell>{product.product_name}</TableCell>
                                <TableCell>
                                  <ProductImage
                                    productId={product.id}
                                    productCode={product.product_code}
                                    productImages={productDetail?.product_images || null}
                                    tposImageUrl={productDetail?.tpos_image_url || product.image_url}
                                    tposProductId={productDetail?.tpos_product_id || null}
                                    baseProductCode={productDetail?.base_product_code || product.base_product_code}
                                  />
                                </TableCell>
                                
                                <TableCell className="text-center">
                                  <Input type="number" min="0" value={preparedQuantities[product.id] ?? product.prepared_quantity} onChange={e => handlePreparedQuantityChange(product.id, e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => {
                             const newQuantity = preparedQuantities[product.id];
                             if (newQuantity !== undefined && newQuantity !== product.prepared_quantity) {
                               updatePreparedQuantityMutation.mutate({
                                 productId: product.id,
                                 newQuantity
                               });
                             }
                           }} className="w-16 text-center h-8" />
                                </TableCell>
                                <TableCell className="text-center">{product.sold_quantity}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {productOrders.map(order => {
                                const isOversell = calculateIsOversell(product.id, order.id, allLiveProducts, ordersWithProducts);
                                const badgeColor = order.customer_status === "vip" ? "bg-yellow-100 text-yellow-800" : "";
                                return <TooltipProvider key={order.id}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                            <Badge variant="secondary" className={`text-xs cursor-pointer hover:scale-105 transition-transform ${badgeColor}`} onClick={() => handleEditOrderItem(order)}>
                                              {isOversell && <AlertTriangle className="h-3 w-3 mr-1" />}
                                              {order.quantity === 1 ? order.session_index : `${order.session_index} x${order.quantity}`}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{isOversell ? "⚠️ Đơn quá số" : `Đơn: ${order.session_index} - SL: ${order.quantity}`}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>;
                              })}
                                    {selectedPhase !== "all" && <QuickAddOrder productId={product.id} phaseId={selectedPhase} sessionId={selectedSession} availableQuantity={product.prepared_quantity - product.sold_quantity} onOrderAdded={qty => handleOrderAdded(product.id, qty)} isAutoPrintEnabled={isAutoPrintEnabled} facebookPostId={sessionData?.facebook_post_id} />}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => changeToHangDatMutation.mutate(product.id)} disabled={selectedPhase === "all"} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Chuyển về Hàng Đặt"}>
                                      <Package className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} disabled={selectedPhase === "all"} title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Chỉnh sửa"}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} disabled={selectedPhase === "all"} className="text-red-600 hover:text-red-700 hover:bg-red-50" title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Xóa"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>;
                      });
                    })()}
                      </TableBody>
                    </Table>
                  </Card>
                </>}
            </TabsContent>

            {/* Comment Hàng Lẻ Tab */}
            <TabsContent value="comment-hang-le" className="space-y-4">
              {isLoadingHangLeComments ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : hangLeComments.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có comment hàng lẻ</h3>
                    <p className="text-muted-foreground text-center">
                      Các comment được đánh dấu là "hàng lẻ" sẽ xuất hiện ở đây
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Danh sách comment hàng lẻ</h3>
                      <Badge variant="outline">{hangLeComments.length} comments</Badge>
                    </div>
                  </div>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Người comment</TableHead>
                          <TableHead className="w-80">Nội dung comment</TableHead>
                          <TableHead className="w-32">Thời gian</TableHead>
                          <TableHead className="w-40">Mã sản phẩm hiện tại</TableHead>
                          <TableHead className="w-48">Gắn mã SP mới</TableHead>
                          <TableHead className="w-24 text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hangLeComments.map((comment: any) => (
                          <TableRow key={comment.id}>
                            <TableCell className="font-medium">
                              {comment.name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-md">
                                <p className="text-sm line-clamp-3">{comment.comment || '-'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {comment.created_time 
                                ? format(new Date(comment.created_time), 'dd/MM/yyyy HH:mm', { locale: vi })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {comment.product_code ? (
                                <Badge variant="secondary" className="font-mono">
                                  {comment.product_code}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Chưa có
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  placeholder="Nhập mã SP..."
                                  value={hangLeProductCodes[comment.id] || ""}
                                  onChange={(e) => {
                                    setHangLeProductCodes(prev => ({
                                      ...prev,
                                      [comment.id]: e.target.value.toUpperCase()
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const code = hangLeProductCodes[comment.id]?.trim();
                                      if (code) {
                                        updateHangLeProductCodeMutation.mutate({
                                          commentId: comment.id,
                                          productCode: code
                                        });
                                      }
                                    }
                                  }}
                                  className="h-8 font-mono uppercase"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  const code = hangLeProductCodes[comment.id]?.trim();
                                  if (code) {
                                    updateHangLeProductCodeMutation.mutate({
                                      commentId: comment.id,
                                      productCode: code
                                    });
                                  } else {
                                    toast.error("Vui lòng nhập mã sản phẩm");
                                  }
                                }}
                                disabled={!hangLeProductCodes[comment.id]?.trim() || updateHangLeProductCodeMutation.isPending}
                                className="h-7"
                              >
                                {updateHangLeProductCodeMutation.isPending ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Gắn"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {ordersWithProducts.length === 0 ? <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có đơn hàng nào</h3>
                    <p className="text-muted-foreground text-center">
                      Đơn hàng sẽ xuất hiện ở đây khi có người mua sản phẩm
                    </p>
                  </CardContent>
                </Card> : <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Danh sách đơn hàng</h3>
                      <Badge variant="outline">{ordersWithProducts.length} đơn</Badge>
                    </div>
                    <Button variant="default" onClick={() => setIsUploadLiveOrdersOpen(true)} disabled={!selectedSession || ordersWithProducts.length === 0}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload TPOS
                    </Button>
                  </div>
                  <Card>
                    <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 font-bold text-base">Mã đơn</TableHead>
                  <TableHead className="w-40 font-bold text-base">Tên SP</TableHead>
                  <TableHead className="w-24 font-bold text-base">Mã SP</TableHead>
                  <TableHead className="w-48 font-bold text-base">Comment</TableHead>
                  <TableHead className="w-16 text-center font-bold text-base">SL</TableHead>
                  <TableHead className="w-28 font-bold text-base">Ghi chú</TableHead>
                  <TableHead className="w-20 text-center font-bold text-base">Thao tác</TableHead>
                  <TableHead className="w-20 text-center font-bold text-base">Trạng thái</TableHead>
                  <TableHead className="w-24 text-center font-bold text-base">Upload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Group orders by session_index and calculate rowSpan
                  const orderGroups = new Map<number, number>();
                  ordersWithProducts.forEach(order => {
                    const count = orderGroups.get(order.session_index) || 0;
                    orderGroups.set(order.session_index, count + 1);
                  });

                  // Track which session_index we've already rendered the first row for
                  const renderedFirstRow = new Set<number>();

                  return ordersWithProducts.map((order, index) => {
                    const bgColorClass = index % 2 === 1 ? 'bg-muted/30' : '';
                    const oversellClass = order.is_oversell 
                      ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900' 
                      : '';
                    
                    // Check if this is the first row for this session_index
                    const isFirstRowForSessionIndex = !renderedFirstRow.has(order.session_index);
                    if (isFirstRowForSessionIndex) {
                      renderedFirstRow.add(order.session_index);
                    }
                    
                    const rowSpan = orderGroups.get(order.session_index) || 1;
                    
                    return (
                  <TableRow 
                    key={order.id}
                    className={`h-12 ${bgColorClass}`}
                  >
                        {/* Chỉ render cột SessionIndex cho dòng đầu tiên của mỗi session_index */}
                        {isFirstRowForSessionIndex && (
                          <TableCell 
                            className="border-r border-l text-center align-top" 
                            rowSpan={rowSpan}
                          >
                            <Badge className="text-sm font-mono">
                              {order.session_index}
                            </Badge>
                          </TableCell>
                        )}
                      
                      <TableCell className="py-2 border-r">
                        <div className="font-medium text-sm">{order.product_name}</div>
                      </TableCell>
                      
                      <TableCell className="py-2 border-r">
                        <span className="text-sm">{order.product_code}</span>
                      </TableCell>
                      
                      <TableCell className="py-2 border-r">
                        {order.facebook_comment_id ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-muted-foreground line-clamp-2 font-bold">
                              {order.comment || '-'}
                            </span>
                            <span className="text-xs text-muted-foreground/70">
                              {order.created_time ? format(new Date(order.created_time), 'dd/MM HH:mm') : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            (Nhập tay)
                          </span>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center py-2 border-r">
                        <span className="text-sm font-medium">{order.quantity}</span>
                      </TableCell>
                      
                      <TableCell className="py-2 border-r">
                        <span className="text-xs text-muted-foreground italic">
                          {order.note || '-'}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center py-2 border-r">
                        <div className="flex items-center justify-center gap-1">
                          {/* Chỉ hiển thị nút Edit nếu chưa upload thành công */}
                          {order.upload_status !== 'success' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditOrderItem(order)} 
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Nút Delete luôn hiển thị */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteSingleOrder(order)} 
                            className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center py-2 border-r">
                        <div className="flex items-center justify-center">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" className="sr-only" defaultChecked={false} />
                            <div className="flex items-center gap-1">
                              <div className="status-dot w-2.5 h-2.5 rounded-full bg-red-500"></div>
                              <span className="status-text text-xs text-red-600 font-medium">Đang chờ</span>
                            </div>
                          </label>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center py-2 border-r">
                        {(() => {
                          const uploadStatus = order.upload_status;
                          const uploadedAt = order.uploaded_at;
                          
                          if (!uploadStatus) {
                            return <span className="text-xs text-muted-foreground">Chưa upload</span>;
                          }
                          
                          const timestamp = uploadedAt ? new Date(uploadedAt) : null;
                          const timeStr = timestamp ? format(timestamp, 'dd/MM HH:mm') : '';
                          
                          return (
                            <div className="flex flex-col gap-1 items-center">
                              <Badge 
                                variant={uploadStatus === 'success' ? 'default' : 'destructive'} 
                                className={uploadStatus === 'success' ? 'bg-green-600' : ''}
                              >
                                {uploadStatus === 'success' ? 'Thành công' : 'Thất bại'}
                              </Badge>
                              {timeStr && <span className="text-xs text-muted-foreground">{timeStr}</span>}
                            </div>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                    );
                  });
                })()}
              </TableBody>
                  </Table>
                </Card>
                </>}
            </TabsContent>

            {/* Products Orders Tab - Statistics by Product Code */}
            <TabsContent value="products-orders" className="space-y-4">
              {ordersWithProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có đơn hàng nào</h3>
                    <p className="text-muted-foreground text-center">
                      Đơn hàng sẽ xuất hiện ở đây khi có người mua sản phẩm
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Thống kê theo mã sản phẩm</h3>
                      <Badge variant="outline">
                        {(() => {
                          const uniqueProducts = new Set();
                          ordersWithProducts.forEach(order => {
                            uniqueProducts.add(`${order.product_code}-${order.product_name}`);
                          });
                          return uniqueProducts.size;
                        })()} sản phẩm
                      </Badge>
                    </div>
                  </div>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-bold text-base">Mã SP</TableHead>
                          <TableHead className="font-bold text-base">Tên sản phẩm</TableHead>
                          <TableHead className="font-bold text-base">Biến thể</TableHead>
                          <TableHead className="font-bold text-base">Hình ảnh</TableHead>
                          <TableHead className="font-bold text-base">Mã đơn hàng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Group orders by product_code and product_name
                          const productOrdersMap = new Map<string, {
                            product_code: string;
                            product_name: string;
                            variants: Map<string, {
                              variant: string;
                              orders: OrderWithProduct[];
                              image_url?: string;
                            }>;
                          }>();

                          ordersWithProducts.forEach(order => {
                            const key = `${order.product_code}`;
                            
                            if (!productOrdersMap.has(key)) {
                              productOrdersMap.set(key, {
                                product_code: order.product_code,
                                product_name: order.product_name,
                                variants: new Map()
                              });
                            }

                            const product = productOrdersMap.get(key)!;
                            
                            // Find the live product to get variant info
                            const liveProduct = liveProducts.find(p => p.product_code === order.product_code);
                            const variantKey = liveProduct?.variant || '';
                            
                            if (!product.variants.has(variantKey)) {
                              product.variants.set(variantKey, {
                                variant: variantKey,
                                orders: [],
                                image_url: liveProduct?.image_url
                              });
                            }

                            product.variants.get(variantKey)!.orders.push(order);
                          });

                          // Convert to array and render
                          return Array.from(productOrdersMap.values()).flatMap(product => {
                            const variantsArray = Array.from(product.variants.values());
                            const totalVariants = variantsArray.length;
                            
                            return variantsArray.flatMap((variantData, variantIndex) => {
                              const isFirstVariant = variantIndex === 0;
                              
                              return (
                                <TableRow key={`${product.product_code}-${variantData.variant}`}>
                                  {isFirstVariant && (
                                    <>
                                      <TableCell 
                                        rowSpan={totalVariants} 
                                        className="font-medium align-top border-r"
                                      >
                                        {product.product_code}
                                      </TableCell>
                                      <TableCell 
                                        rowSpan={totalVariants} 
                                        className="align-top border-r"
                                      >
                                        {product.product_name}
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell className="text-muted-foreground border-r">
                                    {getVariantName(variantData.variant)}
                                  </TableCell>
                                  <TableCell className="border-r">
                                    <ZoomableImage 
                                      src={variantData.image_url} 
                                      alt={product.product_name} 
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1.5">
                                      {variantData.orders.map(order => {
                                        const isOversell = calculateIsOversell(
                                          order.live_product_id, 
                                          order.id, 
                                          liveProducts, 
                                          ordersWithProducts
                                        );
                                        const badgeVariant = isOversell 
                                          ? "destructive" 
                                          : order.uploaded_at 
                                            ? "secondary" 
                                            : "default";
                                        
                                        const getCustomerStatusColor = (status?: string) => {
                                          switch (status) {
                                            case 'bom_hang':
                                              return 'bg-red-500 text-white border-red-600';
                                            case 'thieu_thong_tin':
                                              return 'bg-yellow-500 text-white border-yellow-600';
                                            default:
                                              return '';
                                          }
                                        };
                                        
                                        const customerStatusColor = getCustomerStatusColor(order.customer_status);
                                        
                                        return (
                                          <TooltipProvider key={order.id}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge 
                                                  variant={badgeVariant} 
                                                  className={`cursor-pointer text-xs ${customerStatusColor}`}
                                                  onClick={() => handleEditOrderItem(order)}
                                                >
                                                  {order.session_index}
                                                  {order.quantity > 1 && ` x${order.quantity}`}
                                                  {isOversell && " ⚠️"}
                                                  {order.uploaded_at && " ✓"}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <div className="text-xs">
                                                  <div>Mã: {order.session_index}</div>
                                                  <div>SL: {order.quantity}</div>
                                                  {order.note && <div>Ghi chú: {order.note}</div>}
                                                  {isOversell && (
                                                    <div className="text-red-500 font-semibold">
                                                      ⚠️ Vượt số lượng chuẩn bị
                                                    </div>
                                                  )}
                                                  {order.uploaded_at && (
                                                    <div className="text-green-600 font-semibold">
                                                      ✓ Đã đẩy lên TPOS {format(
                                                        new Date(order.uploaded_at), 
                                                        'dd/MM HH:mm', 
                                                        { locale: vi }
                                                      )}
                                                    </div>
                                                  )}
                                                  {order.customer_status === 'bom_hang' && (
                                                    <div className="text-red-600 font-semibold">
                                                      🚫 BOM HÀNG
                                                    </div>
                                                  )}
                                                  {order.customer_status === 'thieu_thong_tin' && (
                                                    <div className="text-yellow-600 font-semibold">
                                                      ⚠️ THIẾU THÔNG TIN
                                                    </div>
                                                  )}
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Supplier Stats Tab */}
            <TabsContent value="supplier-stats" className="space-y-4">
              <LiveSupplierStats liveProducts={liveProducts} sessionId={selectedSession} phaseId={selectedPhase} />
            </TabsContent>
          </Tabs>
        </>}

      {/* Empty States */}
      {liveSessions.length === 0 && <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chưa có đợt live nào</h3>
            <p className="text-muted-foreground text-center mb-4">
              Tạo đợt live đầu tiên để bắt đầu quản lý sản phẩm và đơn hàng
            </p>
            <Button onClick={() => setIsCreateSessionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo đợt Live mới
            </Button>
          </CardContent>
        </Card>}

      {selectedSession && !selectedPhase && livePhases.length === 0 && <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListOrdered className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Đợt live chưa có phiên nào</h3>
            <p className="text-muted-foreground text-center">
              Có vẻ như đợt live này được tạo bằng hệ thống cũ. Vui lòng tạo đợt live mới để sử dụng tính năng mới.
            </p>
          </CardContent>
        </Card>}

      {/* Dialogs */}
      <CreateLiveSessionDialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen} />
      
      <EditLiveSessionDialog open={isEditSessionOpen} onOpenChange={setIsEditSessionOpen} session={editingSession} />

      <AddProductToLiveDialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen} phaseId={selectedPhase} sessionId={selectedSession} onProductAdded={() => {
        productListRef.current?.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }} />

      <SelectProductFromInventoryDialog open={isSelectFromInventoryOpen} onOpenChange={setIsSelectFromInventoryOpen} phaseId={selectedPhase} sessionId={selectedSession} />

      <EditProductDialog 
        open={isEditProductOpen} 
        onOpenChange={setIsEditProductOpen} 
        product={editingProduct} 
      />

      <EditOrderItemDialog open={isEditOrderItemOpen} onOpenChange={setIsEditOrderItemOpen} orderItem={editingOrderItem} phaseId={selectedPhase} />

      <UploadLiveOrdersToTPOSDialog open={isUploadLiveOrdersOpen} onOpenChange={setIsUploadLiveOrdersOpen} ordersWithProducts={ordersWithProducts} sessionId={selectedSession} />

      {/* Floating Action Buttons */}
      {selectedPhase && selectedPhase !== "all" && <div className="fixed top-16 right-6 flex flex-col gap-3 z-50">
          {/* Thêm từ kho - Primary eye-catching button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  type="button" 
                  size="lg" 
                  onClick={e => {
                    e.preventDefault();
                    setIsSelectFromInventoryOpen(true);
                  }} 
                  className="h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 bg-gradient-to-br from-primary to-primary/80"
                >
                  <Package className="h-10 w-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Thêm từ kho</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>}
      </div>
    </div>;
}