import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/currency-utils";
import { Check, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { ProductImage } from "@/components/products/ProductImage";
import { applyMultiKeywordSearch } from "@/lib/search-utils";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  stock_quantity: number;
  supplier_name?: string;
  product_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
  base_product_code?: string;
}

interface SelectProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
  onSelectMultiple?: (products: Product[]) => void;
  hidePurchasePrice?: boolean;
}

export function SelectProductDialog({ open, onOpenChange, onSelect, onSelectMultiple, hidePurchasePrice = false }: SelectProductDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-select", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Nếu có search (>= 2 ký tự): Search trong database
      if (debouncedSearch.length >= 2) {
        query = applyMultiKeywordSearch(
          query,
          debouncedSearch,
          ['product_name', 'product_code', 'barcode', 'variant']
        );
      } else {
        // Load 50 SP mới nhất (không search)
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
    staleTime: 30000,
    gcTime: 60000,
  });

  const handleSelect = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
    setSelectedProducts(new Set());
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleAddSelectedProducts = () => {
    if (onSelectMultiple && selectedProducts.size > 0) {
      const selectedProductsList = products.filter(p => selectedProducts.has(p.id));
      onSelectMultiple(selectedProductsList);
      onOpenChange(false);
      setSelectedProducts(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedProducts(new Set());
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                  </div>
                ) : (
                  products.map((product) => (
                    <Card
                      key={product.id}
                      className="p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {onSelectMultiple && (
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                            className="mt-1"
                          />
                        )}
                        <ProductImage
                          productId={product.id}
                          productCode={product.product_code}
                          productImages={product.product_images}
                          tposImageUrl={product.tpos_image_url}
                          tposProductId={product.tpos_product_id}
                          baseProductCode={product.base_product_code}
                        />
                        <div className="flex-1 space-y-2 cursor-pointer" onClick={() => handleSelect(product)}>
                          <div className="font-semibold">{product.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.product_code}
                            {product.variant && ` - ${product.variant}`}
                          </div>
                          <div className={hidePurchasePrice ? "text-sm" : "grid grid-cols-2 gap-2 text-sm"}>
                            {!hidePurchasePrice && (
                              <div>
                                <span className="text-muted-foreground">Giá mua: </span>
                                <span className="font-medium">{formatVND(product.purchase_price)}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Giá bán: </span>
                              <span className="font-medium">{formatVND(product.selling_price)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {onSelectMultiple && selectedProducts.size > 0 && (
              <div className="border-t pt-4 flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Đã chọn {selectedProducts.size} sản phẩm
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearSelection}>
                    Bỏ chọn tất cả
                  </Button>
                  <Button size="sm" onClick={handleAddSelectedProducts}>
                    Thêm vào đơn hàng
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hình ảnh</TableHead>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Variant</TableHead>
                  {!hidePurchasePrice && <TableHead>Giá mua</TableHead>}
                  <TableHead>Giá bán</TableHead>
                  {onSelectMultiple && (
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      {!hidePurchasePrice && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      {onSelectMultiple && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={onSelectMultiple ? (hidePurchasePrice ? 7 : 8) : (hidePurchasePrice ? 6 : 7)} className="text-center py-8 text-muted-foreground">
                      {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => !onSelectMultiple && handleSelect(product)}
                    >
                      <TableCell>
                        <ProductImage
                          productId={product.id}
                          productCode={product.product_code}
                          productImages={product.product_images}
                          tposImageUrl={product.tpos_image_url}
                          tposProductId={product.tpos_product_id}
                          baseProductCode={product.base_product_code}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.variant || "-"}
                      </TableCell>
                      {!hidePurchasePrice && <TableCell>{formatVND(product.purchase_price)}</TableCell>}
                      <TableCell>{formatVND(product.selling_price)}</TableCell>
                      {onSelectMultiple && (
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {onSelectMultiple && selectedProducts.size > 0 && (
          <div className="border-t pt-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Đã chọn {selectedProducts.size} sản phẩm
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClearSelection}>
                Bỏ chọn tất cả
              </Button>
              <Button size="sm" onClick={handleAddSelectedProducts}>
                Thêm vào đơn hàng
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
