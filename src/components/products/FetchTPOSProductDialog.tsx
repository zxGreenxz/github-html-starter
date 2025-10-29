import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { searchTPOSProductByCode, getTPOSProductFullDetails, type TPOSProductFullDetails } from "@/lib/tpos-api";
import { EditTPOSProductDialog } from "./EditTPOSProductDialog";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { ProductImage } from "@/components/products/ProductImage";
import { formatVND } from "@/lib/currency-utils";

interface FetchTPOSProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FetchTPOSProductDialog({ open, onOpenChange }: FetchTPOSProductDialogProps) {
  const [productCode, setProductCode] = useState("");
  const debouncedSearch = useDebounce(productCode, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedProduct, setFetchedProduct] = useState<TPOSProductFullDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-select-tpos", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, product_code, product_name, variant, product_images, tpos_image_url, tpos_product_id, base_product_code, selling_price")
        .order("created_at", { ascending: false });
      
      if (debouncedSearch.length >= 2) {
        query = applyMultiKeywordSearch(
          query,
          debouncedSearch,
          ['product_name', 'product_code', 'variant']
        );
      } else {
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Filter for parent products only (product_code === base_product_code)
      const parentProducts = (data || []).filter(
        product => product.product_code === product.base_product_code
      );
      
      return parentProducts;
    },
    enabled: open,
    staleTime: 30000,
  });
  
  const handleFetch = async () => {
    const trimmedCode = productCode.trim();
    
    if (!trimmedCode) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setFetchedProduct(null);
    
    try {
      console.log(`🔍 Searching for: ${trimmedCode}`);
      const searchResult = await searchTPOSProductByCode(trimmedCode);
      
      if (!searchResult) {
        throw new Error(`Không tìm thấy sản phẩm với mã: ${trimmedCode}`);
      }
      
      console.log(`📦 Fetching full details for ID: ${searchResult.Id}`);
      const details = await getTPOSProductFullDetails(searchResult.Id);
      
      setFetchedProduct(details);
      setIsEditDialogOpen(true);
      toast.success(`Đã tìm thấy: ${details.Name}`);
      
    } catch (err: any) {
      console.error('❌ Error fetching product:', err);
      const errorMessage = err.message || "Không thể lấy thông tin sản phẩm";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Lấy sản phẩm từ TPOS</DialogTitle>
            <DialogDescription>
              Chọn sản phẩm từ bảng hoặc nhập trực tiếp mã sản phẩm
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              <Input
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="Nhập mã sản phẩm hoặc tìm kiếm (tối thiểu 2 ký tự)..."
                className="flex-1"
              />
              <Button 
                onClick={handleFetch} 
                disabled={isLoading || !productCode.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tìm...
                  </>
                ) : (
                  "Thêm"
                )}
              </Button>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="text-sm text-muted-foreground">
                {debouncedSearch.trim().length >= 2 
                  ? `Tìm thấy ${products.length} sản phẩm cho "${debouncedSearch}"`
                  : `Hiển thị ${products.length} sản phẩm mới nhất`
                }
              </div>

              <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hình ảnh</TableHead>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead>Giá bán</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingProducts ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-12 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        </TableRow>
                      ))
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow 
                          key={product.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => setProductCode(product.product_code)}
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
                          <TableCell>{formatVND(product.selling_price)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
          </div>
        </DialogContent>
      </Dialog>
      
      <EditTPOSProductDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={fetchedProduct}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          onOpenChange(false);
          setFetchedProduct(null);
          setProductCode("");
          toast.success("Đã cập nhật sản phẩm thành công");
        }}
      />
    </>
  );
}
