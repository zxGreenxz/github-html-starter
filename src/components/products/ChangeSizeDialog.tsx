import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { ProductImage } from "@/components/products/ProductImage";
import { formatVND } from "@/lib/currency-utils";
import {
  searchTPOSProductByCode,
  getTPOSProductFullDetails,
  getStockChangeTemplate,
  postStockChangeQuantity,
  executeStockChange,
  type TPOSProductFullDetails,
  type StockChangeItem
} from "@/lib/tpos-api";

interface ChangeSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeSizeDialog({ open, onOpenChange }: ChangeSizeDialogProps) {
  const queryClient = useQueryClient();
  
  // === STATE MANAGEMENT ===
  const [productCode, setProductCode] = useState("");
  const debouncedSearch = useDebounce(productCode, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sản phẩm đã fetch từ TPOS
  const [fetchedProduct, setFetchedProduct] = useState<TPOSProductFullDetails | null>(null);
  
  // Template items từ TPOS
  const [templateItems, setTemplateItems] = useState<StockChangeItem[]>([]);
  
  // Hai biến thể được chọn
  const [variantAId, setVariantAId] = useState<number | null>(null);
  const [variantBId, setVariantBId] = useState<number | null>(null);
  
  // Số lượng mới (được tính từ template + adjustments)
  const [variantANewQty, setVariantANewQty] = useState(0);
  const [variantBNewQty, setVariantBNewQty] = useState(0);
  
  // Đang submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // === QUERY: Danh sách sản phẩm từ Supabase ===
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-change-size", debouncedSearch],
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
      
      // Chỉ lấy parent products
      const parentProducts = (data || []).filter(
        product => product.product_code === product.base_product_code
      );
      
      return parentProducts;
    },
    enabled: open,
    staleTime: 30000,
  });
  
  // === COMPUTED VALUES ===
  const variantA = fetchedProduct?.ProductVariants.find(v => v.Id === variantAId);
  const variantB = fetchedProduct?.ProductVariants.find(v => v.Id === variantBId);
  
  // Tìm số lượng gốc từ template (LocationId = 12)
  const variantAOriginalQty = templateItems.find(
    item => item.Product.Id === variantAId && item.LocationId === 12
  )?.TheoreticalQuantity || 0;
  
  const variantBOriginalQty = templateItems.find(
    item => item.Product.Id === variantBId && item.LocationId === 12
  )?.TheoreticalQuantity || 0;
  
  // === RESET STATE ===
  const resetState = () => {
    setProductCode("");
    setFetchedProduct(null);
    setTemplateItems([]);
    setVariantAId(null);
    setVariantBId(null);
    setVariantANewQty(0);
    setVariantBNewQty(0);
    setError(null);
  };
  
  // === FETCH PRODUCT FROM TPOS ===
  const handleFetchProduct = async () => {
    const trimmedCode = productCode.trim();
    
    if (!trimmedCode) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setFetchedProduct(null);
    setTemplateItems([]);
    
    try {
      console.log(`🔍 [Change Size] Searching for: ${trimmedCode}`);
      const searchResult = await searchTPOSProductByCode(trimmedCode);
      
      if (!searchResult) {
        throw new Error(`Không tìm thấy sản phẩm với mã: ${trimmedCode}`);
      }
      
      console.log(`📦 [Change Size] Fetching full details for ID: ${searchResult.Id}`);
      const details = await getTPOSProductFullDetails(searchResult.Id);
      
      // ✅ Validate: Phải có ít nhất 2 biến thể
      if (!details.ProductVariants || details.ProductVariants.length < 2) {
        throw new Error("Sản phẩm phải có ít nhất 2 biến thể để chuyển đổi số lượng");
      }
      
      // ✅ Lấy template ngay sau khi fetch
      console.log(`📋 [Change Size] Getting stock template...`);
      const template = await getStockChangeTemplate(details.Id);
      
      setFetchedProduct(details);
      setTemplateItems(template);
      
      toast.success(`Đã tìm thấy: ${details.Name} (${details.ProductVariants.length} biến thể)`);
      
    } catch (err: any) {
      console.error('❌ [Change Size] Error:', err);
      const errorMessage = err.message || "Không thể lấy thông tin sản phẩm";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // === EFFECT: Initialize quantities when variants are selected ===
  useEffect(() => {
    if (variantAId && variantBId && templateItems.length > 0) {
      const itemA = templateItems.find(
        item => item.Product.Id === variantAId && item.LocationId === 12
      );
      const itemB = templateItems.find(
        item => item.Product.Id === variantBId && item.LocationId === 12
      );
      
      if (itemA && itemB) {
        setVariantANewQty(itemA.TheoreticalQuantity);
        setVariantBNewQty(itemB.TheoreticalQuantity);
      }
    }
  }, [variantAId, variantBId, templateItems]);
  
  // === ADJUST QUANTITY HANDLERS ===
  const handleAdjustVariantA = (delta: number) => {
    const newQtyA = variantANewQty + delta;
    const newQtyB = variantBNewQty - delta;
    
    // ✅ Validation: Không cho phép âm
    if (newQtyA < 0) {
      toast.error("❌ Không thể giảm xuống dưới 0");
      return;
    }
    
    if (newQtyB < 0) {
      toast.error("❌ Biến thể đích không đủ số lượng để trừ");
      return;
    }
    
    // ⚠️ Warning: Sắp về 0
    if (newQtyA === 0 && delta < 0) {
      toast.warning("⚠️ Biến thể A sẽ về 0");
    }
    if (newQtyB === 0 && delta > 0) {
      toast.warning("⚠️ Biến thể B sẽ về 0");
    }
    
    setVariantANewQty(newQtyA);
    setVariantBNewQty(newQtyB);
  };
  
  const handleAdjustVariantB = (delta: number) => {
    const newQtyB = variantBNewQty + delta;
    const newQtyA = variantANewQty - delta;
    
    // ✅ Validation: Không cho phép âm
    if (newQtyB < 0) {
      toast.error("❌ Không thể giảm xuống dưới 0");
      return;
    }
    
    if (newQtyA < 0) {
      toast.error("❌ Biến thể nguồn không đủ số lượng để trừ");
      return;
    }
    
    // ⚠️ Warning: Sắp về 0
    if (newQtyB === 0 && delta < 0) {
      toast.warning("⚠️ Biến thể B sẽ về 0");
    }
    if (newQtyA === 0 && delta > 0) {
      toast.warning("⚠️ Biến thể A sẽ về 0");
    }
    
    setVariantBNewQty(newQtyB);
    setVariantANewQty(newQtyA);
  };
  
  // === SUBMIT: Save stock change ===
  const handleSubmit = async () => {
    // ✅ Validation 1: Đã chọn sản phẩm
    if (!fetchedProduct) {
      toast.error("Vui lòng chọn sản phẩm trước");
      return;
    }
    
    // ✅ Validation 2: Đã chọn cả 2 biến thể
    if (!variantAId || !variantBId) {
      toast.error("Vui lòng chọn cả 2 biến thể");
      return;
    }
    
    // ✅ Validation 3: Hai biến thể phải khác nhau
    if (variantAId === variantBId) {
      toast.error("Không thể chuyển số lượng cho cùng một biến thể");
      return;
    }
    
    // ✅ Validation 4: Phải có thay đổi
    const totalChange = Math.abs(variantANewQty - variantAOriginalQty);
    if (totalChange === 0) {
      toast.error("Chưa có thay đổi số lượng nào");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // ✅ Step 1: Đã có template rồi, chỉ cần modify
      const modifiedItems = templateItems.map(item => {
        if (item.LocationId === 12) {
          if (item.Product.Id === variantAId) {
            return { ...item, NewQuantity: variantANewQty };
          }
          if (item.Product.Id === variantBId) {
            return { ...item, NewQuantity: variantBNewQty };
          }
        }
        return item;
      });
      
      console.log(`📤 [Change Size] Submitting changes:`, {
        variantA: {
          id: variantAId,
          code: variantA?.DefaultCode,
          original: variantAOriginalQty,
          new: variantANewQty,
          diff: variantANewQty - variantAOriginalQty
        },
        variantB: {
          id: variantBId,
          code: variantB?.DefaultCode,
          original: variantBOriginalQty,
          new: variantBNewQty,
          diff: variantBNewQty - variantBOriginalQty
        }
      });
      
      // ✅ Step 2: Post quantity changes
      await postStockChangeQuantity(modifiedItems);
      
      // ✅ Step 3: Execute stock change
      await executeStockChange(fetchedProduct.Id);
      
      toast.success(`✅ Đã chuyển ${totalChange} sản phẩm thành công!`);
      
      // ✅ Refresh products list
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-change-size"] });
      
      // ✅ Close modal và reset
      onOpenChange(false);
      resetState();
      
    } catch (error: any) {
      console.error("❌ [Change Size] Failed:", error);
      toast.error(error.message || "Không thể thay đổi số lượng");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // === RENDER ===
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Đổi SIZE - Chuyển đổi số lượng tồn kho</DialogTitle>
          <DialogDescription>
            Chọn sản phẩm từ bảng hoặc nhập trực tiếp mã sản phẩm, sau đó chọn 2 biến thể để chuyển đổi số lượng
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Nhập mã sản phẩm hoặc tìm kiếm (tối thiểu 2 ký tự)..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchProduct();
                }
              }}
            />
            <Button 
              onClick={handleFetchProduct} 
              disabled={isLoading || !productCode.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tìm...
                </>
              ) : (
                "Tìm kiếm"
              )}
            </Button>
          </div>
          
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Products Table */}
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
          
          {/* Product Info & Variant Selection */}
          {fetchedProduct && (
            <div className="space-y-4 border-t pt-4">
              {/* Product Info */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">📦 Thông tin sản phẩm</h3>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {fetchedProduct.ImageUrl && (
                    <div className="col-span-2 mb-2">
                      <img 
                        src={fetchedProduct.ImageUrl} 
                        alt={fetchedProduct.Name}
                        className="w-24 h-24 object-cover rounded border"
                      />
                    </div>
                  )}
                  <span className="text-muted-foreground">Mã:</span>
                  <span className="font-medium">{fetchedProduct.DefaultCode}</span>
                  
                  <span className="text-muted-foreground">Tên:</span>
                  <span className="font-medium">{fetchedProduct.Name}</span>
                  
                  <span className="text-muted-foreground">Tổng số biến thể:</span>
                  <span className="font-medium">{fetchedProduct.ProductVariants?.length || 0}</span>
                </div>
              </div>
              
              {/* Variant Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Variant A */}
                <div className="space-y-2 border rounded-lg p-4">
                  <label className="text-sm font-medium">🔄 Biến thể A</label>
                  <Select 
                    value={variantAId?.toString() || ""} 
                    onValueChange={(value) => setVariantAId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn biến thể A" />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedProduct.ProductVariants.map((variant) => (
                        <SelectItem 
                          key={variant.Id} 
                          value={variant.Id.toString()}
                          disabled={variant.Id === variantBId}
                        >
                          {variant.DefaultCode} - {variant.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {variantAId && (
                    <div className="space-y-2 mt-4">
                      <div className="text-sm text-muted-foreground">
                        Số lượng: {variantAOriginalQty} → <span className="font-bold">{variantANewQty}</span>
                        {variantANewQty !== variantAOriginalQty && (
                          <span className={variantANewQty > variantAOriginalQty ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                            ({variantANewQty > variantAOriginalQty ? '+' : ''}{variantANewQty - variantAOriginalQty})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAdjustVariantA(-1)}
                          disabled={isSubmitting}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 text-center font-bold text-lg">
                          {variantANewQty}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAdjustVariantA(1)}
                          disabled={isSubmitting}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Variant B */}
                <div className="space-y-2 border rounded-lg p-4">
                  <label className="text-sm font-medium">🔄 Biến thể B</label>
                  <Select 
                    value={variantBId?.toString() || ""} 
                    onValueChange={(value) => setVariantBId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn biến thể B" />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedProduct.ProductVariants.map((variant) => (
                        <SelectItem 
                          key={variant.Id} 
                          value={variant.Id.toString()}
                          disabled={variant.Id === variantAId}
                        >
                          {variant.DefaultCode} - {variant.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {variantBId && (
                    <div className="space-y-2 mt-4">
                      <div className="text-sm text-muted-foreground">
                        Số lượng: {variantBOriginalQty} → <span className="font-bold">{variantBNewQty}</span>
                        {variantBNewQty !== variantBOriginalQty && (
                          <span className={variantBNewQty > variantBOriginalQty ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                            ({variantBNewQty > variantBOriginalQty ? '+' : ''}{variantBNewQty - variantBOriginalQty})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAdjustVariantB(-1)}
                          disabled={isSubmitting}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 text-center font-bold text-lg">
                          {variantBNewQty}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAdjustVariantB(1)}
                          disabled={isSubmitting}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !fetchedProduct || !variantAId || !variantBId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu chuyển đổi số lượng"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
