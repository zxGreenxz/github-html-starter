import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle2, XCircle, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TPOSProductItem } from "@/lib/tpos-api";
import { 
  buildInsertV2Payload, 
  uploadToTPOSInsertV2,
  loadImageAsBase64,
  type GroupedProduct 
} from "@/lib/tpos-insertv2-builder";

interface BulkTPOSUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface UploadProgress {
  itemId: string;
  code: string;
  name: string;
  variant: string | null;
  status: UploadStatus;
  error?: string;
}

export function BulkTPOSUploadDialog({ 
  open, 
  onOpenChange, 
  items,
  onSuccess 
}: BulkTPOSUploadDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const totalProducts = items.length;
  
  // Select all functionality
  const allSelected = selectedIds.size === items.length && items.length > 0;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };
  
  const toggleSelect = (itemId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedIds(newSet);
  };
  
  const handleUpload = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm để upload",
      });
      return;
    }
    
    setIsUploading(true);
    setProgress([]);
    setCurrentIndex(0);
    
    // Initialize progress tracking
    const initialProgress: UploadProgress[] = items.map(item => ({
      itemId: item.id,
      code: item.product_code,
      name: item.product_name,
      variant: item.variant || null,
      status: 'pending' as UploadStatus
    }));
    setProgress(initialProgress);
    
    let successCount = 0;
    let errorCount = 0;
    const selectedItems = items.filter(item => selectedIds.has(item.id));
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Skip if not selected
      if (!selectedIds.has(item.id)) continue;
      
      const selectedIdx = selectedItems.findIndex(si => si.id === item.id);
      setCurrentIndex(selectedIdx + 1);
      
      // Update status to uploading
      setProgress(prev => prev.map((p) => 
        p.itemId === item.id ? { ...p, status: 'uploading' } : p
      ));
      
      try {
        // Build grouped product structure for single item
        const groupedProduct: GroupedProduct = {
          baseCode: item.product_code,
          baseName: item.product_name,
          listPrice: item.selling_price || 0,
          purchasePrice: item.unit_price || 0,
          imageBase64: undefined,
          variants: [{
            id: item.id,
            product_code: item.product_code,
            base_product_code: item.base_product_code,
            product_name: item.product_name,
            variant: item.variant || null,
            selling_price: item.selling_price || 0,
            unit_price: item.unit_price || 0,
            quantity: item.quantity || 0,
            supplier_name: item.supplier_name || null,
            product_images: item.product_images || null,
            price_images: item.price_images || null,
            purchase_order_id: item.purchase_order_id,
          }]
        };
        
        // Load image if available
        if (item.product_images && item.product_images.length > 0) {
          const imageUrl = item.product_images[0];
          groupedProduct.imageBase64 = await loadImageAsBase64(imageUrl);
        }
        
        // Build payload and upload
        const payload = buildInsertV2Payload(groupedProduct);
        const tposResponse = await uploadToTPOSInsertV2(payload);
        
        // Create/update product in Supabase after successful upload
        await createOrUpdateProductInSupabase(item, tposResponse);
        
        successCount++;
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, status: 'success' } : p
        ));
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setProgress(prev => prev.map((p) => 
          p.itemId === item.id ? { ...p, status: 'error', error: errorMessage } : p
        ));
        
        console.error(`Failed to upload ${item.product_code}:`, error);
      }
      
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsUploading(false);
    
    // Show summary toast
    if (successCount > 0) {
      toast({
        title: "✅ Upload hoàn tất",
        description: `Thành công: ${successCount}/${selectedIds.size} sản phẩm${errorCount > 0 ? `, Lỗi: ${errorCount}` : ''}`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } else {
      toast({
        variant: "destructive",
        title: "❌ Upload thất bại",
        description: "Không có sản phẩm nào được upload thành công",
      });
    }
  };
  
  // Create or update product in Supabase after successful TPOS upload
  const createOrUpdateProductInSupabase = async (item: TPOSProductItem, tposResponse: any) => {
    try {
      // Extract TPOS product ID and image URL from response
      const tposProductId = tposResponse?.Id || tposResponse?.id;
      const tposImageUrl = tposResponse?.ImageUrl || tposResponse?.imageUrl;
      
      const productData = {
        product_code: item.product_code,
        product_name: item.product_name,
        variant: item.variant || null,
        selling_price: item.selling_price || 0,
        purchase_price: item.unit_price || 0,
        base_product_code: item.base_product_code || null,
        supplier_name: item.supplier_name || null,
        tpos_product_id: tposProductId,
        tpos_image_url: tposImageUrl,
      };
      
      // Check if product exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('product_code', item.product_code)
        .maybeSingle();
      
      if (existing) {
        // Update existing product
        await supabase
          .from('products')
          .update(productData)
          .eq('id', existing.id);
      } else {
        // Insert new product
        await supabase
          .from('products')
          .insert(productData);
      }
    } catch (error) {
      console.error('Failed to create/update product in Supabase:', error);
      // Don't throw - we still consider the upload successful
    }
  };
  
  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  const getStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Thành công</Badge>;
      case 'error':
        return <Badge variant="destructive">Lỗi</Badge>;
      case 'uploading':
        return <Badge variant="secondary">Đang upload...</Badge>;
      default:
        return <Badge variant="outline">Chờ</Badge>;
    }
  };
  
  const progressPercentage = selectedIds.size > 0 ? (currentIndex / selectedIds.size) * 100 : 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload sản phẩm lên TPOS (InsertV2)</DialogTitle>
          <DialogDescription>
            {selectedIds.size > 0 
              ? `Đã chọn ${selectedIds.size}/${totalProducts} sản phẩm để upload` 
              : `${totalProducts} sản phẩm có sẵn`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Đang upload: {currentIndex}/{selectedIds.size}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          )}
          
          {/* Products Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có sản phẩm nào để upload
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={isUploading}
                      />
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const itemProgress = progress.find(p => p.itemId === item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            disabled={isUploading}
                          />
                        </TableCell>
                        <TableCell>
                          {itemProgress && getStatusIcon(itemProgress.status)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.product_code}
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>
                          {item.variant || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.selling_price || 0).toLocaleString('vi-VN')}₫
                        </TableCell>
                        <TableCell className="text-right">
                          {itemProgress ? (
                            <div className="space-y-1">
                              {getStatusBadge(itemProgress.status)}
                              {itemProgress.error && (
                                <p className="text-xs text-red-500 mt-1">
                                  {itemProgress.error}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">Chờ</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Đóng
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedIds.size === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Đang upload...' : `Upload ${selectedIds.size} sản phẩm`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}