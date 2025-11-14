import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Settings2, Edit, ArrowLeftRight, Download, Database } from "lucide-react";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductList } from "@/components/products/ProductList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import { ImportProductsDialog } from "@/components/products/ImportProductsDialog";
import { SupplierStats } from "@/components/products/SupplierStats";
import { AttributeManagementDialog } from "@/components/products/AttributeManagementDialog";
import { FetchTPOSProductDialog } from "@/components/products/FetchTPOSProductDialog";
import { SearchProductForTransferDialog } from "@/components/products/SearchProductForTransferDialog";
import { QuantityTransferDialog } from "@/components/products/QuantityTransferDialog";
import { BackupRestoreDialog } from "@/components/products/BackupRestoreDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsAdmin } from "@/hooks/use-user-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import type { TPOSProductFullDetails } from "@/lib/tpos-api";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";
import * as XLSX from "xlsx";

export default function Products() {
  const isMobile = useIsMobile();
  const { isAdmin, isLoading: isLoadingRole } = useIsAdmin();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAttributeDialogOpen, setIsAttributeDialogOpen] = useState(false);
  const [isFetchTPOSDialogOpen, setIsFetchTPOSDialogOpen] = useState(false);
  const [isSearchTransferOpen, setIsSearchTransferOpen] = useState(false);
  const [isQuantityTransferOpen, setIsQuantityTransferOpen] = useState(false);
  const [selectedProductForTransfer, setSelectedProductForTransfer] = useState<TPOSProductFullDetails | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("products");
  const [productTypeFilter, setProductTypeFilter] = useState<"parent" | "variant" | "all">("parent");
  const [isExportingTPOS, setIsExportingTPOS] = useState(false);
  const [isBackupRestoreDialogOpen, setIsBackupRestoreDialogOpen] = useState(false);

  // Query for displayed products (search results or 50 latest)
  const { data: productsRaw = [], isLoading, refetch } = useQuery({
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

  // Apply product type filter on client side
  const products = productsRaw.filter(product => {
    if (productTypeFilter === "parent") {
      // Sản phẩm cha: product_code === base_product_code
      return product.base_product_code && product.product_code === product.base_product_code;
    } else if (productTypeFilter === "variant") {
      // Biến thể: product_code !== base_product_code
      return product.base_product_code && product.product_code !== product.base_product_code;
    }
    // "all": return everything
    return true;
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


  const handleSupplierClick = (supplierName: string) => {
    setSupplierFilter(supplierName);
    setActiveTab("products");
    setSearchQuery(supplierName);
  };

  const handleProductSelectedForTransfer = (productDetails: TPOSProductFullDetails) => {
    console.log("📦 [Products] Product selected for transfer:", productDetails);
    setSelectedProductForTransfer(productDetails);
    setIsQuantityTransferOpen(true);
  };

  const handleExportTPOSExcel = async () => {
    try {
      setIsExportingTPOS(true);
      toast.info("Đang tải dữ liệu từ TPOS...");

      const token = await getActiveTPOSToken();
      if (!token) {
        toast.error("Không tìm thấy TPOS Bearer Token. Vui lòng cấu hình trong Settings.");
        return;
      }

      const headers = getTPOSHeaders(token);

      // Download File 1: ExportFileWithStandardPriceV2 (Giá mua, Giá vốn)
      toast.info("Đang tải File 1/3...");
      const response1 = await fetch("https://tomato.tpos.vn/Product/ExportFileWithStandardPriceV2", {
        method: "POST",
        headers,
        body: JSON.stringify({ model: { Active: "true" }, ids: "" })
      });
      if (!response1.ok) throw new Error(`Lỗi File 1: ${response1.status}`);
      const blob1 = await response1.blob();
      const arrayBuffer1 = await blob1.arrayBuffer();
      const workbook1 = XLSX.read(arrayBuffer1, { type: 'array' });
      const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
      const data1 = XLSX.utils.sheet_to_json(sheet1, { header: 1 }) as any[][];

      // Download File 2: ExportProductV2 (Giá trị tồn)
      toast.info("Đang tải File 2/3...");
      const response2 = await fetch("https://tomato.tpos.vn/Product/ExportProductV2?Active=true", {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: JSON.stringify({
            Filter: {
              logic: "and",
              filters: [{ field: "Active", operator: "eq", value: true, Clear: "Clear" }]
            }
          }),
          ids: []
        })
      });
      if (!response2.ok) throw new Error(`Lỗi File 2: ${response2.status}`);
      const blob2 = await response2.blob();
      const arrayBuffer2 = await blob2.arrayBuffer();
      const workbook2 = XLSX.read(arrayBuffer2, { type: 'array' });
      const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
      const data2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 }) as any[][];

      // Download File 3: ExportFileWithVariantPrice (Giá biến thể)
      toast.info("Đang tải File 3/3...");
      const response3 = await fetch("https://tomato.tpos.vn/Product/ExportFileWithVariantPrice", {
        method: "POST",
        headers,
        body: JSON.stringify({ model: { Active: "true" }, ids: "" })
      });
      if (!response3.ok) throw new Error(`Lỗi File 3: ${response3.status}`);
      const blob3 = await response3.blob();
      const arrayBuffer3 = await blob3.arrayBuffer();
      const workbook3 = XLSX.read(arrayBuffer3, { type: 'array' });
      const sheet3 = workbook3.Sheets[workbook3.SheetNames[0]];
      const data3 = XLSX.utils.sheet_to_json(sheet3, { header: 1 }) as any[][];

      // Merge data
      toast.info("Đang xử lý và gộp dữ liệu...");

      // Create maps keyed by product code (column index 1)
      const map1 = new Map();
      const map2 = new Map();
      const map3 = new Map();

      // Process File 1 (skip header row)
      for (let i = 1; i < data1.length; i++) {
        const row = data1[i];
        const productCode = row[1]; // Mã sản phẩm
        if (productCode) {
          map1.set(productCode, {
            id: row[0],
            productCode: row[1],
            productName: row[2],
            purchasePrice: row[3], // Giá mua
            costPrice: row[4] // Giá vốn
          });
        }
      }

      // Process File 2 (skip header row)
      for (let i = 1; i < data2.length; i++) {
        const row = data2[i];
        const productCode = row[1];
        if (productCode) {
          map2.set(productCode, {
            inventoryValue: row[3] // Giá trị tồn
          });
        }
      }

      // Process File 3 (skip header row)
      for (let i = 1; i < data3.length; i++) {
        const row = data3[i];
        const productCode = row[1];
        if (productCode) {
          map3.set(productCode, {
            variantPrice: row[3] // Giá biến thể
          });
        }
      }

      // Merge all data
      const mergedData: any[][] = [];
      mergedData.push([
        "Id",
        "Mã sản phẩm",
        "Tên sản phẩm",
        "Giá mua",
        "Giá bán",
        "Tồn kho"
      ]);

      // Get all unique product codes
      const allProductCodes = new Set([...map1.keys(), ...map2.keys(), ...map3.keys()]);

      allProductCodes.forEach(productCode => {
        const item1 = map1.get(productCode) || {};
        const item2 = map2.get(productCode) || {};
        const item3 = map3.get(productCode) || {};

        mergedData.push([
          item1.id || "",
          productCode,
          item1.productName || "",
          item1.purchasePrice || "",
          item3.variantPrice || "", // Giá bán = Giá biến thể
          item2.inventoryValue || "" // Tồn kho = Giá trị tồn
        ]);
      });

      // Create new workbook and export
      const newWorkbook = XLSX.utils.book_new();
      const newSheet = XLSX.utils.aoa_to_sheet(mergedData);
      XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Merged Products");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `TPOS_Merged_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(newWorkbook, fileName);

      toast.success(`Đã xuất Excel thành công! (${allProductCodes.size} sản phẩm)`);
    } catch (error) {
      console.error("❌ Error exporting TPOS Excel:", error);
      toast.error("Lỗi khi xuất Excel: " + (error as Error).message);
    } finally {
      setIsExportingTPOS(false);
    }
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
              <Package className="h-4 w-4 mr-2" />
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

                <Button
                  onClick={handleExportTPOSExcel}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                  disabled={isExportingTPOS}
                >
                  <Download className="h-4 w-4" />
                  {isExportingTPOS ? "Đang xuất..." : "Xuất Excel TPOS"}
                </Button>

                <Button
                  onClick={() => setIsBackupRestoreDialogOpen(true)}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <Database className="h-4 w-4" />
                  Backup
                </Button>

                <Button
                  onClick={() => setIsSearchTransferOpen(true)}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Đổi SIZE
                </Button>

                <Button
                  onClick={() => setIsFetchTPOSDialogOpen(true)}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Chỉnh Sửa
                </Button>

                <Button
                  onClick={() => setIsAttributeDialogOpen(true)}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  Thuộc tính
                </Button>

                {isAdmin && (
                  <Button
                    onClick={() => setIsImportDialogOpen(true)}
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className={isMobile ? "text-xs" : ""}
                  >
                    Import Excel
                  </Button>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {debouncedSearch.length >= 2 
                  ? `Tìm thấy ${products.length} sản phẩm`
                  : `Hiển thị ${products.length} sản phẩm mới nhất (Tổng ${totalCount})`
                }
              </div>
            </Card>

            {/* Product Type Filter */}
            <Card className="p-3">
              <Tabs value={productTypeFilter} onValueChange={(value) => setProductTypeFilter(value as "parent" | "variant" | "all")}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="parent">Sản phẩm</TabsTrigger>
                  <TabsTrigger value="variant">Biến thể</TabsTrigger>
                  <TabsTrigger value="all">Tất cả</TabsTrigger>
                </TabsList>
              </Tabs>
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

        <AttributeManagementDialog
          open={isAttributeDialogOpen}
          onOpenChange={setIsAttributeDialogOpen}
        />

        <FetchTPOSProductDialog
          open={isFetchTPOSDialogOpen}
          onOpenChange={setIsFetchTPOSDialogOpen}
        />

      <BackupRestoreDialog
        open={isBackupRestoreDialogOpen}
        onOpenChange={setIsBackupRestoreDialogOpen}
        onSuccess={refetch}
      />

      <SearchProductForTransferDialog
        open={isSearchTransferOpen}
        onOpenChange={setIsSearchTransferOpen}
        onProductSelected={handleProductSelectedForTransfer}
      />

      <QuantityTransferDialog
        open={isQuantityTransferOpen}
        onOpenChange={setIsQuantityTransferOpen}
        productDetails={selectedProductForTransfer}
        onSuccess={() => {
          refetch();
          setIsQuantityTransferOpen(false);
          setSelectedProductForTransfer(null);
        }}
      />
      </div>
    </div>
  );
}
