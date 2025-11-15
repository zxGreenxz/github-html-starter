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

      // Debug: Log headers to check column structure
      console.log("=".repeat(80));
      console.log("📊 FILE 1 STRUCTURE:");
      console.log("Headers:", data1[0]);
      console.log("Sample Row 1:", data1[1]);
      console.log("Sample Row 2:", data1[2]);

      console.log("=".repeat(80));
      console.log("📊 FILE 2 STRUCTURE:");
      console.log("Headers:", data2[0]);
      console.log("Sample Row 1:", data2[1]);
      console.log("Sample Row 2:", data2[2]);

      console.log("=".repeat(80));
      console.log("📊 FILE 3 STRUCTURE:");
      console.log("Headers:", data3[0]);
      console.log("Sample Row 1:", data3[1]);
      console.log("Sample Row 2:", data3[2]);
      console.log("=".repeat(80));

      // Merge data
      toast.info("Đang xử lý và gộp dữ liệu...");

      // Find column indices dynamically based on headers
      const header1 = data1[0] || [];
      const header2 = data2[0] || [];
      const header3 = data3[0] || [];

      // Helper function to find column index (case-insensitive)
      const findColumnIndex = (headers: any[], searchTerms: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const header = String(headers[i] || "").toLowerCase();
          for (const term of searchTerms) {
            if (header.includes(term.toLowerCase())) {
              console.log(`✅ Found column "${headers[i]}" at index ${i} using term "${term}"`);
              return i;
            }
          }
        }
        console.log(`❌ Could not find column with terms: ${searchTerms.join(', ')}`);
        return -1;
      };

      console.log("\n🔍 FINDING COLUMNS FOR FILE 1:");
      const f1_idIdx = 0;
      const f1_codeIdx = findColumnIndex(header1, ["mã sp", "mã sản phẩm", "mã", "code", "productcode"]);
      const f1_nameIdx = findColumnIndex(header1, ["tên sp", "tên sản phẩm", "tên", "name", "productname"]);
      const f1_purchasePriceIdx = findColumnIndex(header1, ["giá mua", "purchase"]);

      console.log("\n🔍 FINDING COLUMNS FOR FILE 2:");
      const f2_codeIdx = findColumnIndex(header2, ["mã sp", "mã sản phẩm", "mã", "code", "productcode"]);
      const f2_inventoryIdx = findColumnIndex(header2, ["giá trị tồn", "tồn kho", "inventory", "value", "stock"]);

      console.log("\n🔍 FINDING COLUMNS FOR FILE 3:");
      const f3_codeIdx = findColumnIndex(header3, ["mã sp", "mã sản phẩm", "mã", "code", "productcode"]);
      const f3_variantPriceIdx = findColumnIndex(header3, ["giá bán", "selling", "price", "giá"]);

      console.log("\n📌 FINAL COLUMN INDICES:");
      console.log("File 1 - ID:", f1_idIdx, "Code:", f1_codeIdx, "Name:", f1_nameIdx, "Purchase:", f1_purchasePriceIdx);
      console.log("File 2 - Code:", f2_codeIdx, "Inventory:", f2_inventoryIdx);
      console.log("File 3 - Code:", f3_codeIdx, "VariantPrice:", f3_variantPriceIdx);

      // Log all headers for debugging if columns not found
      if (f1_codeIdx === -1 || f2_codeIdx === -1 || f3_codeIdx === -1) {
        console.error("\n❌ MISSING COLUMNS DETECTED!");
        console.error("Please check the exact header names below:\n");

        if (f1_codeIdx === -1) {
          console.error("File 1 all headers:", header1);
        }
        if (f2_codeIdx === -1) {
          console.error("File 2 all headers:", header2);
        }
        if (f3_codeIdx === -1) {
          console.error("File 3 all headers:", header3);
        }

        const missing = [];
        if (f1_codeIdx === -1) missing.push("File 1: Mã sản phẩm");
        if (f2_codeIdx === -1) missing.push("File 2: Mã sản phẩm");
        if (f3_codeIdx === -1) missing.push("File 3: Mã sản phẩm");

        throw new Error(`Không tìm thấy cột: ${missing.join(", ")}. Vui lòng kiểm tra console logs để xem tên cột chính xác.`);
      }

      // Create maps keyed by product code
      const map1 = new Map();
      const map2 = new Map();
      const map3 = new Map();

      // Helper to get value, preserving 0 but converting null/undefined to ""
      const getValue = (val: any) => {
        if (val === null || val === undefined) return "";
        // Keep 0, including numeric 0
        if (val === 0 || val === "0") return val;
        return val;
      };

      // Process File 1 (skip header row)
      console.log("\n📥 Processing File 1...");
      for (let i = 1; i < data1.length; i++) {
        const row = data1[i];
        const productCode = row[f1_codeIdx];
        if (productCode) {
          map1.set(productCode, {
            id: row[f1_idIdx],
            productCode: row[f1_codeIdx],
            productName: row[f1_nameIdx],
            purchasePrice: row[f1_purchasePriceIdx]
          });
        }
      }
      console.log(`✅ Processed ${map1.size} products from File 1`);
      // Log first 3 items
      const firstKeys1 = Array.from(map1.keys()).slice(0, 3);
      firstKeys1.forEach(key => console.log(`  Sample: ${key} =>`, map1.get(key)));

      // Process File 2 (skip header row)
      console.log("\n📥 Processing File 2...");
      for (let i = 1; i < data2.length; i++) {
        const row = data2[i];
        const productCode = row[f2_codeIdx];
        if (productCode) {
          const inventoryValue = row[f2_inventoryIdx];
          map2.set(productCode, {
            inventoryValue: inventoryValue
          });
        }
      }
      console.log(`✅ Processed ${map2.size} products from File 2`);
      const firstKeys2 = Array.from(map2.keys()).slice(0, 3);
      firstKeys2.forEach(key => {
        const item = map2.get(key);
        console.log(`  Sample: ${key} => inventoryValue:`, item.inventoryValue, `(type: ${typeof item.inventoryValue})`);
      });

      // Process File 3 (skip header row)
      console.log("\n📥 Processing File 3...");
      for (let i = 1; i < data3.length; i++) {
        const row = data3[i];
        const productCode = row[f3_codeIdx];
        if (productCode) {
          const variantPrice = row[f3_variantPriceIdx];
          map3.set(productCode, {
            variantPrice: variantPrice
          });
        }
      }
      console.log(`✅ Processed ${map3.size} products from File 3`);
      const firstKeys3 = Array.from(map3.keys()).slice(0, 3);
      firstKeys3.forEach(key => {
        const item = map3.get(key);
        console.log(`  Sample: ${key} => variantPrice:`, item.variantPrice, `(type: ${typeof item.variantPrice})`);
      });

      // Merge all data
      console.log("\n🔀 Merging data...");
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
      console.log(`📊 Total unique products: ${allProductCodes.size}`);

      let sampleCount = 0;
      allProductCodes.forEach(productCode => {
        const item1 = map1.get(productCode) || {};
        const item2 = map2.get(productCode) || {};
        const item3 = map3.get(productCode) || {};

        const row = [
          getValue(item1.id),
          productCode,
          getValue(item1.productName),
          getValue(item1.purchasePrice),
          getValue(item3.variantPrice), // Giá bán = Giá biến thể
          getValue(item2.inventoryValue) // Tồn kho = Giá trị tồn (giữ nguyên 0)
        ];

        // Log first 3 merged rows for debugging
        if (sampleCount < 3) {
          console.log(`\n  Merged row ${sampleCount + 1}:`, {
            productCode,
            id: item1.id,
            name: item1.productName,
            purchase: item1.purchasePrice,
            variantPrice: item3.variantPrice,
            inventory: item2.inventoryValue,
            finalRow: row
          });
          sampleCount++;
        }

        mergedData.push(row);
      });

      // Create new workbook and export
      console.log("\n📄 Creating Excel file...");
      console.log(`Total rows (including header): ${mergedData.length}`);

      const newWorkbook = XLSX.utils.book_new();
      const newSheet = XLSX.utils.aoa_to_sheet(mergedData, {
        cellDates: false,
        dateNF: 'yyyy-mm-dd'
      });

      // Ensure numbers are preserved (including 0)
      const range = XLSX.utils.decode_range(newSheet['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = newSheet[cellAddress];
          if (cell && cell.v === 0) {
            // Explicitly mark 0 values as numbers
            cell.t = 'n';
            cell.v = 0;
          }
        }
      }

      XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Merged Products");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `TPOS_Merged_${timestamp}.xlsx`;

      console.log(`💾 Saving file: ${fileName}`);

      // Download the file
      XLSX.writeFile(newWorkbook, fileName);

      console.log("=".repeat(80));
      console.log("✅ EXPORT COMPLETED SUCCESSFULLY");
      console.log("=".repeat(80));

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
