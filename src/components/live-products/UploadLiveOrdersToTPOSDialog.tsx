import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Upload } from "lucide-react";
import { uploadOrderToTPOS } from "@/lib/tpos-order-uploader";

interface OrderWithProduct {
  id: string;
  session_index: number;
  product_code: string;
  product_name: string;
  quantity: number;
  variant?: string | null;
  upload_status?: string | null;
  live_product_id: string;
  note?: string | null;
}

interface UploadLiveOrdersToTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordersWithProducts: OrderWithProduct[];
  sessionId: string | null;
}

interface UploadProgress {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  step?: number;
}

interface GroupedOrder {
  session_index: number;
  products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    variant?: string | null;
    orderItemIds: string[];
    note?: string | null;
  }>;
  totalQuantity: number;
  uploadStatus?: string | null;
  hasUploadedItems: boolean;
}

export function UploadLiveOrdersToTPOSDialog({
  open,
  onOpenChange,
  ordersWithProducts,
  sessionId,
}: UploadLiveOrdersToTPOSDialogProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<number, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  // Fetch session data
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
      return data;
    },
    enabled: !!sessionId && open,
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProducts(new Set());
      setUploadProgress({});
      setIsUploading(false);
      setAllowDuplicate(false);
    }
  }, [open]);

  // Flatten products into individual rows with unique keys
  const flattenedProducts = useMemo(() => {
    return ordersWithProducts
      .filter(order => order.upload_status !== 'success')
      .map((order, idx) => ({
        ...order,
        uniqueKey: `${order.session_index}-${order.product_code}-${order.id}`,
      }))
      .sort((a, b) => a.session_index - b.session_index);
  }, [ordersWithProducts]);

  // Calculate rowSpan for session_index column
  const sessionIndexRowSpans = useMemo(() => {
    const spans = new Map<number, number>();
    flattenedProducts.forEach(product => {
      spans.set(product.session_index, (spans.get(product.session_index) || 0) + 1);
    });
    return spans;
  }, [flattenedProducts]);

  // Handle select all / deselect all
  const handleSelectAll = () => {
    if (selectedProducts.size === flattenedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(flattenedProducts.map(p => p.uniqueKey)));
    }
  };

  // Handle individual selection
  const handleSelectProduct = (uniqueKey: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(uniqueKey)) {
      newSelected.delete(uniqueKey);
    } else {
      newSelected.add(uniqueKey);
    }
    setSelectedProducts(newSelected);
  };

  // Handle upload
  const handleUpload = async () => {
    if (!sessionData) {
      toast.error("Không tìm thấy thông tin phiên live");
      return;
    }

    if (selectedProducts.size === 0) {
      toast.error("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    setIsUploading(true);
    
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
    
    // Initialize progress
    const initialProgress: Record<number, UploadProgress> = {};
    sessionIndexes.forEach(sessionIndex => {
      initialProgress[sessionIndex] = { status: 'idle' };
    });
    setUploadProgress(initialProgress);

    let successCount = 0;
    let failedCount = 0;

    // Process each session_index group
    for (const sessionIndex of sessionIndexes) {
      const products = orderGroups[sessionIndex];
      const allOrderItemIds = products.map(p => p.id);

      setUploadProgress(prev => ({
        ...prev,
        [sessionIndex]: { status: 'uploading', message: 'Đang xử lý...' }
      }));

      try {
        // Check for duplicate session_index if allowDuplicate is false
        if (!allowDuplicate) {
          setUploadProgress(prev => ({
            ...prev,
            [sessionIndex]: { status: 'uploading', message: 'Đang kiểm tra trùng...' }
          }));

          const { data: existingOrders, error: checkError } = await supabase
            .from('live_orders')
            .select('id, session_index, upload_status, uploaded_at')
            .eq('session_index', sessionIndex)
            .eq('upload_status', 'success')
            .limit(1);

          if (checkError) {
            console.error('Error checking duplicate:', checkError);
            setUploadProgress(prev => ({
              ...prev,
              [sessionIndex]: { 
                status: 'error', 
                message: `Lỗi kiểm tra trùng: ${checkError.message}` 
              }
            }));
            failedCount++;
            continue;
          }

          if (existingOrders && existingOrders.length > 0) {
            const existingOrder = existingOrders[0];
            console.warn(`⚠️ Order ${sessionIndex} already uploaded:`, existingOrder);
            setUploadProgress(prev => ({
              ...prev,
              [sessionIndex]: { 
                status: 'error', 
                message: `Đơn ${sessionIndex} đã được upload lúc ${new Date(existingOrder.uploaded_at).toLocaleString('vi-VN')}. Tick "Cho phép upload đơn trùng" để upload lại.` 
              }
            }));
            failedCount++;
            continue;
          }
        }
        
        console.log('🚀 [DEBUG] Upload params:', {
          sessionIndex,
          productsCount: products.length,
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date,
            session_index: sessionIndex,
          },
        });
        
        const result = await uploadOrderToTPOS({
          sessionIndex,
          products: products.map(p => ({
            product_code: p.product_code,
            product_name: p.product_name,
            quantity: p.quantity,
            note: p.note,
          })),
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date || sessionData.start_date,
            session_index: sessionIndex,
          },
          orderItemIds: allOrderItemIds,
          onProgress: (step, message) => {
            setUploadProgress(prev => ({
              ...prev,
              [sessionIndex]: { status: 'uploading', message, step }
            }));
          },
        });

        if (result.success) {
          setUploadProgress(prev => ({
            ...prev,
            [sessionIndex]: { 
              status: 'success', 
              message: `Đã upload ${products.length} sản phẩm` 
            }
          }));
          successCount++;
        } else {
          setUploadProgress(prev => ({
            ...prev,
            [sessionIndex]: { 
              status: 'error', 
              message: result.error || 'Lỗi không xác định' 
            }
          }));
          failedCount++;
        }
      } catch (error) {
        console.error(`Error uploading order ${sessionIndex}:`, error);
        setUploadProgress(prev => ({
          ...prev,
          [sessionIndex]: { 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Lỗi không xác định' 
          }
        }));
        failedCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0 && failedCount === 0) {
      toast.success(`Đã upload thành công ${successCount} đơn hàng`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Upload hoàn tất: ${successCount} thành công, ${failedCount} thất bại`);
    } else if (failedCount > 0) {
      toast.error(`Upload thất bại ${failedCount} đơn hàng`);
    }
  };

  const renderUploadStatus = (sessionIndex: number) => {
    const progress = uploadProgress[sessionIndex];
    if (!progress) return null;

    switch (progress.status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-xs text-muted-foreground">{progress.message}</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600">{progress.message}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">{progress.message}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Checkbox for allowing duplicate uploads */}
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Checkbox
              id="allow-duplicate"
              checked={allowDuplicate}
              onCheckedChange={(checked) => setAllowDuplicate(!!checked)}
              disabled={isUploading}
            />
            <label
              htmlFor="allow-duplicate"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Cho phép upload đơn trùng (bỏ qua kiểm tra đã upload)
            </label>
          </div>
          {sessionData && (
            <div className="bg-muted p-3 rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Phiên live:</span> {sessionData.session_name}
                </div>
                <div>
                  <span className="font-medium">Thời gian:</span>{' '}
                  {new Date(sessionData.start_date).toLocaleDateString('vi-VN')} -{' '}
                  {new Date(sessionData.end_date).toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SessionIndex</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-center">Tổng SL</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={selectedProducts.size === flattenedProducts.length && flattenedProducts.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={isUploading}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Không có sản phẩm nào
                    </TableCell>
                  </TableRow>
                ) : (
                  flattenedProducts.map((product, index) => {
                    const isFirstInSessionGroup = index === 0 || 
                      flattenedProducts[index - 1].session_index !== product.session_index;
                    const rowSpan = sessionIndexRowSpans.get(product.session_index) || 1;

                    return (
                      <TableRow key={product.uniqueKey}>
                        {/* Merge SessionIndex cell */}
                        {isFirstInSessionGroup && (
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
                              {product.variant && ` (${product.variant})`}
                            </span>
                            {' x '}
                            <span className="font-semibold">{product.quantity}</span>
                          </div>
                        </TableCell>
                        
                        {/* Tổng SL - merge cho session_index */}
                        {isFirstInSessionGroup && (
                          <TableCell 
                            className="text-center align-top border-r" 
                            rowSpan={rowSpan}
                          >
                            <Badge variant="outline">
                              {flattenedProducts
                                .filter(p => p.session_index === product.session_index)
                                .reduce((sum, p) => sum + p.quantity, 0)}
                            </Badge>
                          </TableCell>
                        )}
                        
                        {/* Ghi chú */}
                        <TableCell>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {product.note ? (
                              <span title={product.note}>{product.note}</span>
                            ) : (
                              <span className="italic text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Trạng thái - merge cho session_index */}
                        {isFirstInSessionGroup && (
                          <TableCell className="align-top border-r" rowSpan={rowSpan}>
                            {renderUploadStatus(product.session_index)}
                          </TableCell>
                        )}
                        
                        {/* Checkbox - mỗi dòng 1 checkbox */}
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedProducts.has(product.uniqueKey)}
                            onCheckedChange={() => handleSelectProduct(product.uniqueKey)}
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Hủy
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedProducts.size === 0 || isUploading}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
