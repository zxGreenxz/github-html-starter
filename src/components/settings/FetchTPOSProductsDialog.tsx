import { useState } from "react";
import { Download, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/currency-utils";
import { detectSupplierFromProductName } from "@/lib/supplier-detector";

interface TPOSProduct {
  Id: number;
  DefaultCode: string;
  Name: string;
  Variant?: string | null;
  BasePrice: number;
  ListPrice: number;
  Image?: string | null;
  OnHand: number;
  Barcode?: string | null;
  CategoryName?: string | null;
}

interface FetchTPOSProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FetchTPOSProductsDialog({ open, onOpenChange, onSuccess }: FetchTPOSProductsDialogProps) {
  const [selectedCount, setSelectedCount] = useState<string>("50");
  const [isFetching, setIsFetching] = useState(false);
  const [tposProducts, setTposProducts] = useState<TPOSProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const { toast } = useToast();

  const handleFetchProducts = async () => {
    setIsFetching(true);
    setTposProducts([]);
    setSelectedProducts(new Set());

    try {
      const { queryWithAutoRefresh } = await import('@/lib/query-with-auto-refresh');
      
      const result = await queryWithAutoRefresh(async () => {
        const { data, error } = await supabase.functions.invoke('fetch-tpos-products', {
          body: { top: parseInt(selectedCount), skip: 0 }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch products');
        }

        return data;
      }, 'tpos');

      setTposProducts(result.products || []);
      setRawResponse(result);
      toast({
        title: "✅ Lấy sản phẩm thành công",
        description: `Đã lấy ${result.products?.length || 0} sản phẩm từ TPOS`,
      });
    } catch (error: any) {
      console.error('Error fetching TPOS products:', error);
      toast({
        variant: "destructive",
        title: "❌ Lỗi lấy sản phẩm",
        description: error.message || "Không thể lấy sản phẩm từ TPOS",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const toggleSelect = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === tposProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(tposProducts.map(p => p.Id.toString())));
    }
  };

  const handleImport = async () => {
    if (selectedProducts.size === 0) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất 1 sản phẩm để import",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    const productsToImport = tposProducts.filter(p => 
      selectedProducts.has(p.Id.toString())
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < productsToImport.length; i++) {
      const tposProduct = productsToImport[i];
      
      try {
        const productData = {
          product_code: tposProduct.DefaultCode,
          product_name: tposProduct.Name,
          variant: tposProduct.Variant || null,
          selling_price: tposProduct.ListPrice || 0,
          purchase_price: tposProduct.BasePrice || 0,
          unit: 'Cái',
          stock_quantity: tposProduct.OnHand || 0,
          barcode: tposProduct.Barcode || null,
          category: tposProduct.CategoryName || null,
          tpos_product_id: tposProduct.Id,
          tpos_image_url: tposProduct.Image || null,
          supplier_name: detectSupplierFromProductName(tposProduct.Name),
        };

        const { error } = await supabase
          .from('products')
          .upsert(productData, { 
            onConflict: 'product_code',
            ignoreDuplicates: false 
          });

        if (error) {
          errors.push(`${tposProduct.DefaultCode}: ${error.message}`);
          skipped++;
        } else {
          imported++;
        }

        setImportProgress(Math.round(((i + 1) / productsToImport.length) * 100));

      } catch (err: any) {
        errors.push(`${tposProduct.DefaultCode}: ${err.message}`);
        skipped++;
      }
    }

    setIsImporting(false);

    if (imported > 0) {
      toast({
        title: "✅ Import thành công",
        description: `Đã import ${imported} sản phẩm${skipped > 0 ? `, bỏ qua ${skipped}` : ''}`,
      });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: "❌ Import thất bại",
        description: `Không import được sản phẩm nào. ${errors[0] || ''}`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Lấy sản phẩm từ TPOS
          </DialogTitle>
          <DialogDescription>
            Import sản phẩm từ TPOS về hệ thống nội bộ
          </DialogDescription>
        </DialogHeader>

        {tposProducts.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Số lượng sản phẩm:</label>
              <Select value={selectedCount} onValueChange={setSelectedCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 sản phẩm</SelectItem>
                  <SelectItem value="100">100 sản phẩm</SelectItem>
                  <SelectItem value="200">200 sản phẩm</SelectItem>
                  <SelectItem value="500">500 sản phẩm</SelectItem>
                  <SelectItem value="1000">1000 sản phẩm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleFetchProducts} 
              disabled={isFetching}
              className="w-full"
            >
              {isFetching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang lấy sản phẩm...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Lấy sản phẩm
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedProducts.size === tposProducts.length && tposProducts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">Chọn tất cả</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCount} onValueChange={setSelectedCount} disabled={isFetching}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 sản phẩm</SelectItem>
                      <SelectItem value="100">100 sản phẩm</SelectItem>
                      <SelectItem value="200">200 sản phẩm</SelectItem>
                      <SelectItem value="500">500 sản phẩm</SelectItem>
                      <SelectItem value="1000">1000 sản phẩm</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleFetchProducts}
                    disabled={isFetching}
                    variant="outline"
                    size="sm"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Đang cập nhật...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Cập nhật
                      </>
                    )}
                  </Button>
                  <Badge variant="secondary">
                    {tposProducts.length} sản phẩm
                  </Badge>
                </div>
              </div>

              <ScrollArea className="h-[400px] w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-16">Ảnh</TableHead>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead className="text-right">Giá mua</TableHead>
                      <TableHead className="text-right">Tồn kho</TableHead>
                      <TableHead>NCC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tposProducts.map((product) => {
                      const supplierName = detectSupplierFromProductName(product.Name);
                      return (
                        <TableRow key={product.Id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedProducts.has(product.Id.toString())}
                              onCheckedChange={() => toggleSelect(product.Id.toString())}
                            />
                          </TableCell>
                          <TableCell>
                            <img 
                              src={product.Image || '/placeholder.svg'}
                              alt={product.Name}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.DefaultCode}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{product.Name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {product.Variant || '-'}
                          </TableCell>
                          <TableCell className="text-right">{formatVND(product.ListPrice)}</TableCell>
                          <TableCell className="text-right">{formatVND(product.BasePrice)}</TableCell>
                          <TableCell className="text-right">{product.OnHand || 0}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {supplierName || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {rawResponse && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">JSON Response từ TPOS:</label>
                  <ScrollArea className="h-[200px] w-full rounded-md border bg-muted p-4">
                    <pre className="text-xs">
                      {JSON.stringify(rawResponse, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Đang import...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between">
              <Badge variant="outline" className="text-sm">
                <CheckCircle className="h-3 w-3 mr-1" />
                Đã chọn: {selectedProducts.size}/{tposProducts.length}
              </Badge>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={isImporting}
                >
                  Hủy
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={selectedProducts.size === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang import...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import vào kho ({selectedProducts.size})
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
