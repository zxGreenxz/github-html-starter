import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, CheckSquare, Square } from "lucide-react";
import { uploadToTPOS, type TPOSProductItem } from "@/lib/tpos-api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { formatVND } from "@/lib/currency-utils";

interface SimpleProductUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

export function SimpleProductUploadDialog({ open, onOpenChange, items, onSuccess }: SimpleProductUploadDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(item => item.id)));

  // Filter only items without variants
  const itemsWithoutVariants = useMemo(() => {
    return items.filter(item => !item.variant || item.variant.trim() === '');
  }, [items]);

  // Get selected items
  const selectedItems = useMemo(() => {
    return itemsWithoutVariants.filter(item => selectedIds.has(item.id));
  }, [itemsWithoutVariants, selectedIds]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã copy",
      description: "Đã copy kết quả vào clipboard",
    });
  };

  // Toggle individual item
  const toggleItem = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Toggle all items
  const toggleAll = () => {
    const allIds = itemsWithoutVariants.map(item => item.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isAllSelected = itemsWithoutVariants.length > 0 && itemsWithoutVariants.every(item => selectedIds.has(item.id));

  const handleUpload = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Upload to TPOS
      const result = await uploadToTPOS(selectedItems, (step, total, message) => {
        console.log(`Progress: ${step}/${total} - ${message}`);
      });

      setUploadResult(result);
      setIsResultOpen(true);

      if (result.success) {
        toast({
          title: "✅ Upload thành công",
          description: `Đã upload ${result.successCount}/${result.totalProducts} sản phẩm lên TPOS`,
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "❌ Upload thất bại",
          description: result.errors?.[0]?.errorMessage || "Có lỗi xảy ra",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "❌ Lỗi",
        description: error instanceof Error ? error.message : "Không thể upload sản phẩm",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload sản phẩm đơn giản lên TPOS (không có biến thể)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {itemsWithoutVariants.length === 0 ? (
            <Alert>
              <AlertDescription>
                Không có sản phẩm nào không có biến thể để upload.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Đã chọn {selectedItems.length}/{itemsWithoutVariants.length} sản phẩm
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="gap-2"
                >
                  {isAllSelected ? (
                    <>
                      <Square className="w-4 h-4" />
                      Bỏ chọn tất cả
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      Chọn tất cả
                    </>
                  )}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Chọn tất cả"
                        />
                      </TableHead>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead className="text-right">Giá mua</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead className="text-center">SL</TableHead>
                      <TableHead>NCC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsWithoutVariants.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                            aria-label={`Chọn ${item.product_code}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.product_code}
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">
                          {formatVND(item.unit_price || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatVND(item.selling_price || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.supplier_name || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {uploadResult && (
            <Alert variant={uploadResult.success ? "default" : "destructive"}>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">
                    {uploadResult.success ? "✅ Thành công" : "❌ Thất bại"}
                  </div>
                  <div className="text-sm">
                    <div>Tổng số: {uploadResult.totalProducts}</div>
                    <div>Thành công: {uploadResult.successCount}</div>
                    <div>Thất bại: {uploadResult.failedCount}</div>
                    {uploadResult.savedIds > 0 && (
                      <div>Đã lưu TPOS IDs: {uploadResult.savedIds}</div>
                    )}
                  </div>

                  {uploadResult.errors?.length > 0 && (
                    <div className="text-sm text-destructive">
                      <div className="font-semibold">Lỗi:</div>
                      {uploadResult.errors.map((error: any, idx: number) => (
                        <div key={idx}>- {error.message}</div>
                      ))}
                    </div>
                  )}

                  <Collapsible open={isResultOpen} onOpenChange={setIsResultOpen}>
                    <CollapsibleTrigger className="text-sm underline">
                      {isResultOpen ? "Ẩn" : "Xem"} JSON response
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(uploadResult, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(JSON.stringify(uploadResult, null, 2))}
                        className="mt-2"
                      >
                        Copy JSON
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={isUploading || selectedItems.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {selectedItems.length} sản phẩm
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
