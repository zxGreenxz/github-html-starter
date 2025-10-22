import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { ProductImage } from "@/components/products/ProductImage";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { applyMultiKeywordSearch } from "@/lib/search-utils";

// Helper: Extract base name prefix from product name
const extractBaseNamePrefix = (productName: string): string | null => {
  if (!productName) return null;
  
  // Priority 1: Format "xxx (y)" - extract xxx
  if (productName.includes('(')) {
    const basePrefix = productName.split('(')[0].trim();
    if (basePrefix.length > 0) return basePrefix;
  }
  
  // Priority 2: Format "xxx - y" - extract xxx
  if (productName.includes(' - ')) {
    return productName.split(' - ')[0].trim();
  }
  
  // Priority 3: Format "xxx-y" (no space) - extract xxx
  if (productName.includes('-')) {
    return productName.split('-')[0].trim();
  }
  
  return null; // No pattern detected
};

// Helper: Fetch all variants by name pattern or base_product_code
const fetchAllVariants = async (product: InventoryProduct) => {
  // CASE 1: Product name has "-" → Find by name pattern
  if (product.product_name.includes('-')) {
    const basePrefix = extractBaseNamePrefix(product.product_name);
    if (!basePrefix) return [product]; // Fallback to single product
    
    const { data: matchingProducts, error } = await supabase
      .from("products")
      .select("*")
      .ilike("product_name", `${basePrefix}%`);
    
    if (error) throw error;
    
    // Filter locally to ensure exact prefix match
    const filtered = (matchingProducts || []).filter((p: InventoryProduct) => {
      const pPrefix = extractBaseNamePrefix(p.product_name);
      return pPrefix === basePrefix;
    });
    
    return filtered.length > 1 ? filtered : [product];
  }
  
  // CASE 2: No "-" in name → Use base_product_code
  const baseCode = product.base_product_code || product.product_code;
  
  const { data: variants, error } = await supabase
    .from("products")
    .select("*")
    .eq("base_product_code", baseCode)
    .not("variant", "is", null)
    .neq("variant", "")
    .neq("product_code", baseCode);
  
  if (error) throw error;
  
  return variants && variants.length > 0 ? variants : [product];
};

interface SelectProductFromInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  sessionId: string;
}

interface InventoryProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  base_product_code?: string;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
  product_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
}

export function SelectProductFromInventoryDialog({
  open,
  onOpenChange,
  phaseId,
  sessionId,
}: SelectProductFromInventoryDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const preparedQuantity = 1; // Fixed quantity for direct add
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch products from inventory
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["inventory-products-select", debouncedSearch],
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
      return data as InventoryProduct[];
    },
    enabled: open,
    staleTime: 30000,
    gcTime: 60000,
  });

  // Add product to live session mutation
  const addProductMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found");

      // Fetch all variants (similar to barcode scanning logic)
      const allVariants = await fetchAllVariants(product);
      
      if (allVariants.length === 0) {
        throw new Error("Không tìm thấy sản phẩm hoặc biến thể nào");
      }

      // Check existing products in live session
      const variantCodes = allVariants.map((v: InventoryProduct) => v.product_code);
      const { data: existingProducts, error: checkError } = await supabase
        .from("live_products")
        .select("id, product_code")
        .eq("live_phase_id", phaseId)
        .in("product_code", variantCodes);

      if (checkError) throw checkError;

      // Map: product_code -> { id, exists }
      const existingMap = new Map(
        (existingProducts || []).map((p: { id: string; product_code: string }) => [
          p.product_code, 
          { id: p.id, exists: true }
        ])
      );

      // Separate insert & update logic
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      for (const variant of allVariants) {
        const existing = existingMap.get(variant.product_code);
        
        if (existing) {
          // Sản phẩm đã tồn tại → Update created_at để đẩy lên đầu
          toUpdate.push({
            id: existing.id,
            created_at: new Date().toISOString()
          });
        } else {
          // Sản phẩm chưa tồn tại → Insert mới
          const imageUrl = variant.product_images?.[0] || variant.tpos_image_url || null;
          toInsert.push({
            product_code: variant.product_code,
            product_name: variant.product_name,
            variant: variant.variant,
            base_product_code: variant.base_product_code,
            prepared_quantity: quantity,
            sold_quantity: 0,
            live_session_id: sessionId,
            live_phase_id: phaseId,
            image_url: imageUrl,
          });
        }
      }

      // Batch insert (nếu có sản phẩm mới)
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("live_products")
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // Batch update created_at (nếu có sản phẩm đã tồn tại)
      if (toUpdate.length > 0) {
        for (const update of toUpdate) {
          const { error: updateError } = await supabase
            .from("live_products")
            .update({ created_at: update.created_at })
            .eq("id", update.id);
          if (updateError) throw updateError;
        }
      }

      return {
        totalVariants: allVariants.length,
        insertedCount: toInsert.length,
        updatedCount: toUpdate.length,
        baseProductCode: allVariants[0]?.product_code.split('X')[0] || product.product_code,
        baseProductName: allVariants[0]?.product_name || product.product_name,
      };
    },
  onSuccess: (result) => {
    toast.success("Đã thêm sản phẩm", {
      description: `${result.baseProductCode} - ${result.baseProductName}\nThêm mới: ${result.insertedCount} | Đã có: ${result.updatedCount}`,
    });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      onOpenChange(false);
      setSearchQuery("");
    },
    onError: (error: Error) => {
      toast.error("Lỗi", {
        description: error.message || "Không thể thêm sản phẩm",
      });
    },
  });

  // Quick add product to live session (without adding to inventory)
  const createQuickProductMutation = useMutation({
    mutationFn: async (productName: string) => {
      if (!productName.trim()) {
        throw new Error("Tên sản phẩm không được để trống");
      }

      // Generate product code: N/Ax (x = auto-increment based on current live session)
      const { data: existingLiveProducts, error: fetchError } = await supabase
        .from("live_products")
        .select("product_code")
        .eq("live_phase_id", phaseId)
        .ilike("product_code", "N/A%")
        .order("product_code", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let nextNumber = 1;
      if (existingLiveProducts && existingLiveProducts.length > 0) {
        const lastCode = existingLiveProducts[0].product_code;
        const match = lastCode.match(/N\/A(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const productCode = `N/A${nextNumber}`;

      // Insert directly to live_products (không thêm vào kho)
      const { error: insertError } = await supabase
        .from("live_products")
        .insert({
          product_code: productCode,
          product_name: productName.trim(),
          prepared_quantity: 1,
          sold_quantity: 0,
          live_session_id: sessionId,
          live_phase_id: phaseId,
        });

      if (insertError) throw insertError;

      return { product_code: productCode, product_name: productName.trim() };
    },
    onSuccess: (result) => {
      toast.success("Đã thêm sản phẩm vào phiên live", {
        description: `${result.product_code} - ${result.product_name}`,
      });
      
      // Reload live products list
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      
      onOpenChange(false);
      setSearchQuery("");
    },
    onError: (error: Error) => {
      toast.error("Lỗi thêm sản phẩm", {
        description: error.message,
      });
    },
  });

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
            <DialogDescription>
              Tìm và chọn sản phẩm từ kho để thêm vào phiên live
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Input
                placeholder="Tìm kiếm hoặc nhập tên sản phẩm mới..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => createQuickProductMutation.mutate(searchQuery)}
                disabled={!searchQuery.trim() || createQuickProductMutation.isPending}
                title="Tạo sản phẩm mới từ tên tìm kiếm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
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
                      className="p-4 cursor-pointer transition-colors hover:bg-muted/50 active:scale-[0.98]"
                      onClick={() => {
                        if (!addProductMutation.isPending) {
                          addProductMutation.mutate({
                            productId: product.id,
                            quantity: preparedQuantity,
                          });
                        }
                      }}
                    >
                      <div className="space-y-2">
                        <div className="font-semibold">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.product_code}
                          {product.variant && ` - ${product.variant}`}
                        </div>
                        <div className="text-sm">
                          <div>
                            <span className="text-muted-foreground">Giá bán: </span>
                            <span className="font-medium">{formatVND(product.selling_price)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tồn kho: </span>
                            <span className="font-medium">{product.stock_quantity}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
            
            <div className="pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Đóng
              </Button>
            </div>
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
          <DialogDescription>
            Tìm và chọn sản phẩm từ kho để thêm vào phiên live
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Tìm kiếm hoặc nhập tên sản phẩm mới..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => createQuickProductMutation.mutate(searchQuery)}
                disabled={!searchQuery.trim() || createQuickProductMutation.isPending}
                title="Tạo sản phẩm mới từ tên tìm kiếm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
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
                  <TableHead>Giá bán</TableHead>
                  <TableHead>Tồn kho</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="cursor-pointer hover:bg-muted/50 active:bg-muted"
                      onClick={() => {
                        if (!addProductMutation.isPending) {
                          addProductMutation.mutate({
                            productId: product.id,
                            quantity: preparedQuantity,
                          });
                        }
                      }}
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
                      <TableCell>{product.stock_quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Đóng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
