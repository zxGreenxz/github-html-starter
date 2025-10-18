import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Trash2, Store, Download } from "lucide-react";
import { searchTPOSProduct, importProductFromTPOS } from "@/lib/tpos-api";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductList } from "@/components/products/ProductList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import { ImportProductsDialog } from "@/components/products/ImportProductsDialog";
import { ImportTPOSIdsDialog } from "@/components/products/ImportTPOSIdsDialog";
import { SupplierStats } from "@/components/products/SupplierStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsAdmin } from "@/hooks/use-user-role";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export default function Products() {
  const isMobile = useIsMobile();
  const { isAdmin, isLoading: isLoadingRole } = useIsAdmin();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportTPOSIdsDialogOpen, setIsImportTPOSIdsDialogOpen] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("products");

  // Query for displayed products (search results or 50 latest)
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["products-search", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      // If search query exists (>= 2 chars), search in database
      if (debouncedSearch.length >= 2) {
        query = applyMultiKeywordSearch(
          query,
          debouncedSearch,
          ['product_name', 'product_code', 'barcode']
        );
      } else {
        // Otherwise, load 50 latest products
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    gcTime: 60000,
  });

  // Query for total count
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["products-total-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Query for product stats using RPC function
  const { data: productStats } = useQuery({
    queryKey: ["products-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_stats");
      if (error) throw error;
      return data as {
        total_products: number;
        total_inventory_value: number;
        out_of_stock_count: number;
        negative_stock_count: number;
      };
    },
    staleTime: 60000,
  });

  // Mutation to update missing suppliers
  const updateSuppliersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("update_missing_suppliers");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`Đã cập nhật ${count} sản phẩm`);
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      refetch();
    },
    onError: (error) => {
      console.error("Error updating suppliers:", error);
      toast.error("Có lỗi khi cập nhật NCC");
    },
  });

  // Mutation to import from TPOS
  const importFromTPOSMutation = useMutation({
    mutationFn: async (productCode: string) => {
      const tposProduct = await searchTPOSProduct(productCode);
      if (!tposProduct) {
        throw new Error("Không tìm thấy sản phẩm trên TPOS");
      }
      const result = await importProductFromTPOS(tposProduct);
      return { tposProduct, result };
    },
    onSuccess: ({ tposProduct, result }) => {
      const message = result.isUpdated 
        ? `Đã cập nhật sản phẩm: ${tposProduct.Name}` 
        : `Đã thêm sản phẩm mới: ${tposProduct.Name}`;
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
      queryClient.invalidateQueries({ queryKey: ["products-stats"] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Có lỗi khi lấy sản phẩm từ TPOS");
    },
  });

  const handleImportFromTPOS = () => {
    if (debouncedSearch.length < 2) {
      toast.error("Vui lòng nhập mã sản phẩm cần tìm");
      return;
    }
    importFromTPOSMutation.mutate(debouncedSearch.trim());
  };

  const handleClearTPOSIds = async () => {
    setIsClearing(true);
    try {
      // Update all products with TPOS IDs, set to NULL
      const { error, data } = await supabase
        .from("products")
        .update({ 
          tpos_product_id: null, 
          productid_bienthe: null 
        })
        .or("tpos_product_id.not.is.null,productid_bienthe.not.is.null")
        .select();

      if (error) throw error;

      toast.success(`Đã xóa TPOS IDs của ${data?.length || 0} sản phẩm`);
      refetch();
    } catch (error) {
      console.error("Error clearing TPOS IDs:", error);
      toast.error("Có lỗi khi xóa TPOS IDs");
    } finally {
      setIsClearing(false);
      setIsAlertDialogOpen(false);
    }
  };

  const handleSupplierClick = (supplierName: string) => {
    setSupplierFilter(supplierName);
    setActiveTab("products");
    setSearchQuery(supplierName);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className={`${isMobile ? "p-4 space-y-4" : "p-8 space-y-6"}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kho Sản Phẩm</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý tồn kho và thông tin sản phẩm
              </p>
            </div>
          </div>
          {!isLoadingRole && !isAdmin && (
            <Badge variant="secondary" className="gap-2">
              <ShieldAlert className="h-3 w-3" />
              Chỉ xem
            </Badge>
          )}
        </div>

        {/* Stats - Always show for entire database */}
        {!isMobile && <ProductStats stats={productStats} />}

        {/* Tabs for Products and Supplier Stats */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Danh sách sản phẩm
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              <Store className="h-4 w-4 mr-2" />
              Thống kê theo NCC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 mt-0">
            {/* Search & Actions */}
            <Card className="p-4 space-y-3">
              <div className={`flex ${isMobile ? "flex-col" : "flex-row items-center"} gap-4`}>
                <div className="flex-1 space-y-2 w-full">
                  <Input
                    placeholder="Tìm kiếm theo mã SP, tên, mã vạch (tối thiểu 2 ký tự)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSupplierFilter(null);
                    }}
                    className="w-full"
                  />
                  {supplierFilter && (
                    <Badge variant="secondary" className="gap-2">
                      Đang lọc theo: {supplierFilter}
                      <button
                        onClick={() => {
                          setSupplierFilter(null);
                          setSearchQuery("");
                        }}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </div>

                {isAdmin && (
                  <div className={`flex gap-2 ${isMobile ? "w-full flex-wrap" : ""}`}>
                    <Button
                      onClick={() => updateSuppliersMutation.mutate()}
                      variant="secondary"
                      size={isMobile ? "sm" : "default"}
                      className={isMobile ? "flex-1 text-xs" : ""}
                      disabled={updateSuppliersMutation.isPending}
                    >
                      <Store className="h-4 w-4 mr-2" />
                      {updateSuppliersMutation.isPending ? "Đang cập nhật..." : "Cập nhật NCC"}
                    </Button>
                    <Button
                      onClick={() => setIsAlertDialogOpen(true)}
                      variant="destructive"
                      size={isMobile ? "sm" : "default"}
                      className={isMobile ? "flex-1 text-xs" : ""}
                      disabled={isClearing}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isClearing ? "Đang xóa..." : "Xóa TPOS IDs"}
                    </Button>
                    <Button
                      onClick={() => setIsImportTPOSIdsDialogOpen(true)}
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      className={isMobile ? "flex-1 text-xs" : ""}
                    >
                      Import TPOS IDs
                    </Button>
                    <Button
                      onClick={() => setIsImportDialogOpen(true)}
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      className={isMobile ? "flex-1 text-xs" : ""}
                    >
                      Import Excel
                    </Button>
                    {debouncedSearch.length >= 2 && (
                      <Button
                        onClick={handleImportFromTPOS}
                        variant="default"
                        size={isMobile ? "sm" : "default"}
                        className={isMobile ? "flex-1 text-xs" : ""}
                        disabled={importFromTPOSMutation.isPending}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {importFromTPOSMutation.isPending ? "Đang lấy..." : "Lấy từ TPOS"}
                      </Button>
                    )}
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className={isMobile ? "flex-1" : ""}
                    >
                      Thêm SP
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {debouncedSearch.length >= 2 
                  ? `Tìm thấy ${products.length} sản phẩm`
                  : `Hiển thị ${products.length} sản phẩm mới nhất (Tổng ${totalCount})`
                }
              </div>
            </Card>

            {/* Product List */}
            <ProductList
              products={products}
              isLoading={isLoading}
              onRefetch={refetch}
              supplierFilter={supplierFilter}
              isAdmin={isAdmin}
              searchQuery={debouncedSearch}
            />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-0">
            <SupplierStats onSupplierClick={handleSupplierClick} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CreateProductDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={refetch}
        />
        
        <ImportProductsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={refetch}
        />

        <ImportTPOSIdsDialog
          open={isImportTPOSIdsDialogOpen}
          onOpenChange={setIsImportTPOSIdsDialogOpen}
          onSuccess={refetch}
        />

        <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa TPOS IDs</AlertDialogTitle>
              <AlertDialogDescription className="text-destructive font-semibold">
                Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu tpos_product_id và productid_bienthe?
                <br /><br />
                ⚠️ Hành động này sẽ set NULL cho 2 cột này trong TOÀN BỘ sản phẩm và KHÔNG THỂ hoàn tác!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearTPOSIds}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isClearing}
              >
                {isClearing ? "Đang xóa..." : "Xác nhận xóa"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
