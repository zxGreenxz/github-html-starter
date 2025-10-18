import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { formatVND } from "@/lib/currency-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchTPOSProduct, importProductFromTPOS } from "@/lib/tpos-api";
import { toast } from "sonner";

export default function SearchProducts() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["search-products", debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];

      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 9999);

      query = applyMultiKeywordSearch(
        query,
        debouncedSearch,
        ['product_name', 'product_code', 'barcode']
      );

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000,
    gcTime: 60000,
  });

  const importFromTPOSMutation = useMutation({
    mutationFn: async (productCode: string) => {
      // Step 1: Search in TPOS
      const tposProduct = await searchTPOSProduct(productCode);
      if (!tposProduct) {
        throw new Error(`Không tìm thấy sản phẩm "${productCode}" trong TPOS`);
      }

      // Step 2: Import to database
      return await importProductFromTPOS(tposProduct);
    },
    onSuccess: (data) => {
      toast.success(`✅ Đã import sản phẩm: ${data.product_name}`);
      // Refresh search results
      queryClient.invalidateQueries({ queryKey: ["search-products"] });
    },
    onError: (error: Error) => {
      toast.error(`❌ Lỗi: ${error.message}`);
      console.error(error);
    },
  });

  const handleImportFromTPOS = () => {
    if (debouncedSearch.trim().length === 0) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    importFromTPOSMutation.mutate(debouncedSearch.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tìm Kiếm Sản Phẩm</h1>
            <p className="text-muted-foreground mt-1">
              Tìm kiếm sản phẩm theo mã hoặc tên
            </p>
          </div>
        </div>

        {/* Search Input */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập mã sản phẩm hoặc tên sản phẩm (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-sm text-muted-foreground mt-2">
              Vui lòng nhập ít nhất 2 ký tự để tìm kiếm
            </p>
          )}
        </Card>

        {/* Results */}
        <Card className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-4">Đang tìm kiếm...</p>
            </div>
          ) : debouncedSearch.length < 2 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nhập mã sản phẩm hoặc tên sản phẩm để tìm kiếm
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Không tìm thấy sản phẩm nào với từ khóa "{debouncedSearch}"
              </p>
              <Button
                onClick={handleImportFromTPOS}
                disabled={importFromTPOSMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {importFromTPOSMutation.isPending ? "Đang lấy từ TPOS..." : "Lấy sản phẩm từ TPOS"}
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Tìm thấy <span className="font-semibold text-foreground">{products.length}</span> sản phẩm
                </p>
              </div>

              {isMobile ? (
                // Mobile view - Cards
                <div className="space-y-4">
                  {products.map((product) => (
                    <Card key={product.id} className="p-4">
                      {product.product_images && product.product_images.length > 0 && (
                        <img
                          src={product.product_images[0]}
                          alt={product.product_name}
                          className="w-full h-32 object-cover rounded-md mb-3"
                        />
                      )}
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold">{product.product_name}</p>
                          <p className="text-sm text-muted-foreground">{product.product_code}</p>
                        </div>
                        {product.variant && (
                          <Badge variant="outline">{product.variant}</Badge>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Giá bán</p>
                            <p className="font-semibold text-primary">
                              {formatVND(product.selling_price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tồn kho</p>
                            <p className="font-semibold">{product.stock_quantity} {product.unit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Giá mua</p>
                            <p>{formatVND(product.purchase_price)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">NCC</p>
                            <p className="truncate">{product.supplier_name || "-"}</p>
                          </div>
                        </div>
                        {product.category && (
                          <div>
                            <p className="text-sm text-muted-foreground">Nhóm</p>
                            <Badge variant="secondary">{product.category}</Badge>
                          </div>
                        )}
                        {product.barcode && (
                          <div>
                            <p className="text-sm text-muted-foreground">Barcode</p>
                            <p className="text-sm font-mono">{product.barcode}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // Desktop view - Table
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ảnh</TableHead>
                        <TableHead>Mã SP</TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead>Giá bán</TableHead>
                        <TableHead>Giá mua</TableHead>
                        <TableHead>Tồn kho</TableHead>
                        <TableHead>Đơn vị</TableHead>
                        <TableHead>Nhà cung cấp</TableHead>
                        <TableHead>Nhóm</TableHead>
                        <TableHead>Barcode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            {product.product_images && product.product_images.length > 0 ? (
                              <img
                                src={product.product_images[0]}
                                alt={product.product_name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {product.product_code}
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.product_name}
                          </TableCell>
                          <TableCell>
                            {product.variant ? (
                              <Badge variant="outline">{product.variant}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatVND(product.selling_price)}
                          </TableCell>
                          <TableCell>
                            {formatVND(product.purchase_price)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.stock_quantity > 0 ? "default" : "destructive"}>
                              {product.stock_quantity}
                            </Badge>
                          </TableCell>
                          <TableCell>{product.unit}</TableCell>
                          <TableCell>{product.supplier_name || "-"}</TableCell>
                          <TableCell>
                            {product.category ? (
                              <Badge variant="secondary">{product.category}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {product.barcode || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
