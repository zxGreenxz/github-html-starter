import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadOrderToTPOS } from "@/lib/tpos-order-uploader";
import { toast } from "sonner";

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  session_index: number;
  tpos_order_id?: string | null;
  code_tpos_order_id?: string | null;
  quantity: number;
  order_date: string;
  is_oversell?: boolean;
  uploaded_at?: string | null;
  upload_status?: string | null;
  customer_status?: string;
}

interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
  customer_status?: string;
}

interface UploadOrdersToTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithProduct[];
  sessionId: string | null;
  phaseId: string | null;
}

interface UploadProgress {
  status: 'pending' | 'uploading' | 'success' | 'failed';
  message: string;
  codeTPOSOrderId?: string;
}

export function UploadOrdersToTPOSDialog({
  open,
  onOpenChange,
  orders,
  sessionId,
}: UploadOrdersToTPOSDialogProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<number, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  // Fetch session info
  const { data: sessionData } = useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const { data, error } = await supabase
        .from('live_sessions')
        .select('start_date, end_date, session_name')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      
      // Extract session index from session_name (e.g., "Đợt 3" -> 3)
      const sessionIndex = data.session_name?.match(/\d+/)?.[0] || '1';
      
      return {
        ...data,
        session_index: parseInt(sessionIndex),
      };
    },
    enabled: !!sessionId && open,
  });

  // Flatten products into individual rows
  const flattenedProducts = orders.map((order, idx) => ({
    ...order,
    uniqueKey: `${order.session_index}-${order.product_code}-${idx}`,
  }));

  // Calculate rowSpan for session_index column
  const sessionIndexRowSpans = new Map<number, number>();
  flattenedProducts.forEach(product => {
    sessionIndexRowSpans.set(product.session_index, (sessionIndexRowSpans.get(product.session_index) || 0) + 1);
  });

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProducts(new Set());
      setUploadProgress(new Map());
      setIsUploading(false);
    }
  }, [open]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(flattenedProducts.map(p => p.uniqueKey)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (uniqueKey: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(uniqueKey);
    } else {
      newSelected.delete(uniqueKey);
    }
    setSelectedProducts(newSelected);
  };

  const handleUpload = async () => {
    if (!sessionData) {
      toast.error("Không thể tải thông tin session");
      return;
    }

    if (selectedProducts.size === 0) {
      toast.error("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    setIsUploading(true);
    const newProgress = new Map<number, UploadProgress>();
    
    // Group selected products by session_index
    const selectedItems = flattenedProducts.filter(p => selectedProducts.has(p.uniqueKey));
    const orderGroups = selectedItems.reduce((acc, product) => {
      if (!acc[product.session_index]) {
        acc[product.session_index] = [];
      }
      acc[product.session_index].push(product);
      return acc;
    }, {} as Record<number, typeof selectedItems>);

    const sessionIndexes = Object.keys(orderGroups).map(Number);
    
    // Initialize progress for all selected order groups
    sessionIndexes.forEach(sessionIndex => {
      newProgress.set(sessionIndex, {
        status: 'pending',
        message: 'Đang chờ...',
      });
    });
    setUploadProgress(newProgress);

    let successCount = 0;
    let failedCount = 0;

    // Upload orders sequentially
    for (const sessionIndex of sessionIndexes) {
      const orderItems = orderGroups[sessionIndex];
      if (!orderItems || orderItems.length === 0) continue;

      // Update status to uploading
      newProgress.set(sessionIndex, {
        status: 'uploading',
        message: 'Đang upload...',
      });
      setUploadProgress(new Map(newProgress));

      try {
        // Convert order items to products array
        const products = orderItems.map(item => ({
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
        }));
        
        const result = await uploadOrderToTPOS({
          sessionIndex,
          products,
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date,
            session_index: sessionData.session_index,
          },
          onProgress: (step, message) => {
            newProgress.set(sessionIndex, {
              status: 'uploading',
              message: `Bước ${step}/4: ${message}`,
            });
            setUploadProgress(new Map(newProgress));
          },
        });

        if (result.success) {
          newProgress.set(sessionIndex, {
            status: 'success',
            message: `Đã upload ${products.length} sản phẩm`,
            codeTPOSOrderId: result.codeTPOSOrderId,
          });
          successCount++;
        } else {
          newProgress.set(sessionIndex, {
            status: 'failed',
            message: result.error || 'Upload thất bại',
          });
          failedCount++;
        }
      } catch (error) {
        newProgress.set(sessionIndex, {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Lỗi không xác định',
        });
        failedCount++;
      }

      setUploadProgress(new Map(newProgress));
      
      // Delay between uploads to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsUploading(false);

    // Show summary toast
    if (successCount > 0 && failedCount === 0) {
      toast.success(`Upload thành công ${successCount} đơn hàng`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Thành công: ${successCount}, Thất bại: ${failedCount}`);
    } else {
      toast.error(`Upload thất bại ${failedCount} đơn hàng`);
    }
  };

  const allSelected = flattenedProducts.length > 0 && selectedProducts.size === flattenedProducts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS</DialogTitle>
          {sessionData && (
            <p className="text-sm text-muted-foreground">
              Khoảng ngày: {new Date(sessionData.start_date).toLocaleDateString('vi-VN')} - {new Date(sessionData.end_date).toLocaleDateString('vi-VN')} | 
              Session Index: {sessionData.session_index}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SessionIndex</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">Tổng SL</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={isUploading}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {flattenedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Không có đơn hàng nào
                  </TableCell>
                </TableRow>
              ) : (
                flattenedProducts.map((product, index) => {
                  const isFirstInOrderGroup = index === 0 || 
                    flattenedProducts[index - 1].session_index !== product.session_index;
                  const rowSpan = sessionIndexRowSpans.get(product.session_index) || 1;
                  const progress = uploadProgress.get(product.session_index);

                  return (
                    <TableRow key={product.uniqueKey}>
                      {/* Merge SessionIndex cell */}
                      {isFirstInOrderGroup && (
                        <TableCell 
                          className="font-medium align-top border-r" 
                          rowSpan={rowSpan}
                        >
                          {product.session_index}
                        </TableCell>
                      )}
                      
                      {/* Sản phẩm - mỗi dòng 1 sản phẩm */}
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{product.product_code}</span>
                          {' - '}
                          <span className="text-muted-foreground">
                            {product.product_name}
                          </span>
                          {' x '}
                          <span className="font-semibold">{product.quantity}</span>
                        </div>
                      </TableCell>
                      
                      {/* Tổng SL - merge cho session_index */}
                      {isFirstInOrderGroup && (
                        <TableCell 
                          className="text-right align-top border-r" 
                          rowSpan={rowSpan}
                        >
                          <span className="font-medium">
                            {flattenedProducts
                              .filter(p => p.session_index === product.session_index)
                              .reduce((sum, p) => sum + p.quantity, 0)}
                          </span>
                        </TableCell>
                      )}
                      
                      {/* Trạng thái - merge cho session_index */}
                      {isFirstInOrderGroup && (
                        <TableCell className="align-top border-r" rowSpan={rowSpan}>
                          {progress ? (
                            <div className="flex items-center gap-2">
                              {progress.status === 'uploading' && (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm">{progress.message}</span>
                                </>
                              )}
                              {progress.status === 'success' && (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  <div className="text-sm">
                                    <div className="text-green-600">Thành công</div>
                                    {progress.codeTPOSOrderId && (
                                      <div className="text-muted-foreground">{progress.codeTPOSOrderId}</div>
                                    )}
                                  </div>
                                </>
                              )}
                              {progress.status === 'failed' && (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <span className="text-sm text-red-600">{progress.message}</span>
                                </>
                              )}
                              {progress.status === 'pending' && (
                                <Badge variant="outline">Đang chờ</Badge>
                              )}
                            </div>
                          ) : product.upload_status === 'success' && product.code_tpos_order_id ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <div className="text-sm">
                                <div className="text-green-600">Đã upload</div>
                                <div className="text-muted-foreground">{product.code_tpos_order_id}</div>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">Chưa upload</Badge>
                          )}
                        </TableCell>
                      )}
                      
                      {/* Checkbox - mỗi dòng 1 checkbox */}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedProducts.has(product.uniqueKey)}
                          onCheckedChange={(checked) => handleSelectProduct(product.uniqueKey, checked as boolean)}
                          disabled={isUploading}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Đã chọn: {selectedProducts.size}/{flattenedProducts.length} sản phẩm
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                {isUploading ? 'Đóng' : 'Hủy'}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={selectedProducts.size === 0 || isUploading || !sessionData}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang upload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {selectedProducts.size > 0 ? `${selectedProducts.size} sản phẩm` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
