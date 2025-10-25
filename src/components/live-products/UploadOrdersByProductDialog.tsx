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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Package, Search } from "lucide-react";
import { uploadProductToTPOS } from "@/lib/tpos-product-uploader";

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

interface UploadOrdersByProductDialogProps {
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

interface ProductGroup {
  product_code: string;
  product_name: string;
  variant?: string | null;
  orders: Array<{
    id: string;
    session_index: number;
    quantity: number;
    note?: string | null;
  }>;
  totalQuantity: number;
  sessionIndexes: number[];
  hasUploadedItems: boolean;
}

export function UploadOrdersByProductDialog({
  open,
  onOpenChange,
  ordersWithProducts,
  sessionId,
}: UploadOrdersByProductDialogProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [sessionIndexSearch, setSessionIndexSearch] = useState("");

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
      setAllowDuplicate(true);
      setProductSearch("");
      setSessionIndexSearch("");
    }
  }, [open]);

  // Group orders by product_code
  const productGroups = useMemo(() => {
    const groups = new Map<string, ProductGroup>();

    ordersWithProducts
      .filter(order => allowDuplicate || order.upload_status !== 'success')
      .forEach(order => {
        const key = order.product_code;
        
        if (!groups.has(key)) {
          groups.set(key, {
            product_code: order.product_code,
            product_name: order.product_name,
            variant: order.variant,
            orders: [],
            totalQuantity: 0,
            sessionIndexes: [],
            hasUploadedItems: false,
          });
        }

        const group = groups.get(key)!;
        group.orders.push({
          id: order.id,
          session_index: order.session_index,
          quantity: order.quantity,
          note: order.note,
        });
        group.totalQuantity += order.quantity;
        
        if (!group.sessionIndexes.includes(order.session_index)) {
          group.sessionIndexes.push(order.session_index);
        }
        
        if (order.upload_status === 'success') {
          group.hasUploadedItems = true;
        }
      });

    return Array.from(groups.values()).sort((a, b) => 
      a.product_code.localeCompare(b.product_code)
    );
  }, [ordersWithProducts, allowDuplicate]);

  // Apply search filters
  const filteredProductGroups = useMemo(() => {
    let filtered = productGroups;

    // Filter by product search
    if (productSearch.trim()) {
      const searchLower = productSearch.toLowerCase().trim();
      const keywords = searchLower.split(/\s+/).filter(k => k.length > 0);

      if (keywords.length === 1) {
        // Single keyword: OR search
        const keyword = keywords[0];
        filtered = filtered.filter(group =>
          group.product_code.toLowerCase().includes(keyword) ||
          group.product_name.toLowerCase().includes(keyword) ||
          (group.variant?.toLowerCase() || '').includes(keyword)
        );
      } else {
        // Multiple keywords: ALL in product_name
        filtered = filtered.filter(group => {
          const nameLower = group.product_name.toLowerCase();
          return keywords.every(keyword => nameLower.includes(keyword));
        });
      }
    }

    // Filter by session_index
    if (sessionIndexSearch.trim()) {
      const searchIndex = sessionIndexSearch.trim();
      filtered = filtered.filter(group =>
        group.sessionIndexes.some(idx => idx.toString().includes(searchIndex))
      );
    }

    return filtered;
  }, [productGroups, productSearch, sessionIndexSearch]);

  // Handle select all / deselect all
  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProductGroups.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProductGroups.map(g => g.product_code)));
    }
  };

  // Handle individual selection
  const handleSelectProduct = (productCode: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productCode)) {
      newSelected.delete(productCode);
    } else {
      newSelected.add(productCode);
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
    
    const selectedGroups = filteredProductGroups.filter(g => selectedProducts.has(g.product_code));
    
    // Initialize progress
    const initialProgress: Record<string, UploadProgress> = {};
    selectedGroups.forEach(group => {
      initialProgress[group.product_code] = { status: 'idle' };
    });
    setUploadProgress(initialProgress);

    let successCount = 0;
    let failedCount = 0;

    // Process each product group
    for (const group of selectedGroups) {
      setUploadProgress(prev => ({
        ...prev,
        [group.product_code]: { status: 'uploading', message: 'Đang xử lý...' }
      }));

      try {
        const result = await uploadProductToTPOS({
          product_code: group.product_code,
          product_name: group.product_name,
          variant: group.variant,
          orders: group.orders,
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date || sessionData.start_date,
          },
          onProgress: (step, message) => {
            setUploadProgress(prev => ({
              ...prev,
              [group.product_code]: { status: 'uploading', message, step }
            }));
          },
        });

        if (result.success) {
          setUploadProgress(prev => ({
            ...prev,
            [group.product_code]: { 
              status: 'success', 
              message: `Đã upload ${group.orders.length} đơn, tổng ${group.totalQuantity} sản phẩm` 
            }
          }));
          successCount++;
        } else {
          setUploadProgress(prev => ({
            ...prev,
            [group.product_code]: { 
              status: 'error', 
              message: result.error || 'Lỗi không xác định' 
            }
          }));
          failedCount++;
        }
      } catch (error) {
        console.error(`Error uploading product ${group.product_code}:`, error);
        setUploadProgress(prev => ({
          ...prev,
          [group.product_code]: { 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Lỗi không xác định' 
          }
        }));
        failedCount++;
      }
    }

    setIsUploading(false);
    setSelectedProducts(new Set());

    if (successCount > 0 && failedCount === 0) {
      toast.success(`Đã upload thành công ${successCount} sản phẩm`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Upload hoàn tất: ${successCount} thành công, ${failedCount} thất bại`);
    } else if (failedCount > 0) {
      toast.error(`Upload thất bại ${failedCount} sản phẩm`);
    }
  };

  const renderUploadStatus = (productCode: string) => {
    const progress = uploadProgress[productCode];
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
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Upload theo sản phẩm lên TPOS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Checkbox for allowing duplicate uploads */}
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <Checkbox
              id="allow-duplicate-product"
              checked={allowDuplicate}
              onCheckedChange={(checked) => setAllowDuplicate(!!checked)}
              disabled={isUploading}
            />
            <label
              htmlFor="allow-duplicate-product"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Cho phép upload sản phẩm đã upload (bỏ qua kiểm tra đã upload)
            </label>
          </div>

          {/* Search inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm sản phẩm..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
                disabled={isUploading}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm SessionIndex..."
                value={sessionIndexSearch}
                onChange={(e) => setSessionIndexSearch(e.target.value)}
                className="pl-10"
                disabled={isUploading}
              />
            </div>
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
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead className="text-center">Số đơn</TableHead>
                  <TableHead className="text-center">Tổng SL</TableHead>
                  <TableHead>SessionIndex</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={selectedProducts.size === filteredProductGroups.length && filteredProductGroups.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={isUploading}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProductGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Không có sản phẩm nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductGroups.map((group) => (
                    <TableRow key={group.product_code}>
                      <TableCell className="font-medium">{group.product_code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{group.product_name}</div>
                          {group.variant && (
                            <div className="text-xs text-muted-foreground">{group.variant}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{group.orders.length}</TableCell>
                      <TableCell className="text-center font-semibold">{group.totalQuantity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {group.sessionIndexes.sort((a, b) => a - b).map(idx => (
                            <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                              {idx}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderUploadStatus(group.product_code)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedProducts.has(group.product_code)}
                          onCheckedChange={() => handleSelectProduct(group.product_code)}
                          disabled={isUploading}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Đã chọn: {selectedProducts.size} / {filteredProductGroups.length} sản phẩm
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                Hủy
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || selectedProducts.size === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang upload...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Upload {selectedProducts.size} sản phẩm
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
