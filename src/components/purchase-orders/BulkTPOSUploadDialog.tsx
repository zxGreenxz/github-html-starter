import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, XCircle, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TPOSProductItem } from "@/lib/tpos-api";
import { 
  groupVariantsByBase, 
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
  code: string;
  name: string;
  variantCount: number;
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
  
  const groupedProducts = groupVariantsByBase(items);
  const totalProducts = groupedProducts.length;
  
  const handleUpload = async () => {
    setIsUploading(true);
    setProgress([]);
    setCurrentIndex(0);
    
    // Initialize progress tracking
    const initialProgress: UploadProgress[] = groupedProducts.map(group => ({
      code: group.baseCode,
      name: group.baseName,
      variantCount: group.variants.length,
      status: 'pending' as UploadStatus
    }));
    setProgress(initialProgress);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < groupedProducts.length; i++) {
      const group = groupedProducts[i];
      setCurrentIndex(i + 1);
      
      // Update status to uploading
      setProgress(prev => prev.map((p, idx) => 
        idx === i ? { ...p, status: 'uploading' } : p
      ));
      
      try {
        // Load image if available
        const firstVariant = group.variants[0];
        if (firstVariant.product_images && firstVariant.product_images.length > 0) {
          const imageUrl = firstVariant.product_images[0];
          group.imageBase64 = await loadImageAsBase64(imageUrl);
        }
        
        // Build payload and upload
        const payload = buildInsertV2Payload(group);
        await uploadToTPOSInsertV2(payload);
        
        successCount++;
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'success' } : p
        ));
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'error', error: errorMessage } : p
        ));
        
        console.error(`Failed to upload ${group.baseCode}:`, error);
      }
      
      // Small delay between uploads
      if (i < groupedProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsUploading(false);
    
    // Show summary toast
    if (successCount > 0) {
      toast({
        title: "✅ Upload hoàn tất",
        description: `Thành công: ${successCount}/${totalProducts} sản phẩm${errorCount > 0 ? `, Lỗi: ${errorCount}` : ''}`,
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
  
  const progressPercentage = totalProducts > 0 ? (currentIndex / totalProducts) * 100 : 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload sản phẩm lên TPOS (InsertV2)</DialogTitle>
          <DialogDescription>
            Upload {totalProducts} sản phẩm (bao gồm cả biến thể) lên hệ thống TPOS
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Đang upload: {currentIndex}/{totalProducts}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          )}
          
          {/* Products Table */}
          {groupedProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có sản phẩm nào để upload
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="text-center">Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedProducts.map((group, idx) => (
                    <TableRow key={group.baseCode}>
                      <TableCell>
                        {progress[idx] && getStatusIcon(progress[idx].status)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {group.baseCode}
                      </TableCell>
                      <TableCell>{group.baseName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {group.variants.length} {group.variants.length === 1 ? 'variant' : 'variants'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {group.listPrice.toLocaleString('vi-VN')}₫
                      </TableCell>
                      <TableCell className="text-right">
                        {progress[idx] ? (
                          <div className="space-y-1">
                            {getStatusBadge(progress[idx].status)}
                            {progress[idx].error && (
                              <p className="text-xs text-red-500 mt-1">
                                {progress[idx].error}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">Chờ</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Variants Preview */}
          {!isUploading && groupedProducts.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">📋 Chi tiết biến thể:</h4>
              {groupedProducts.map(group => (
                <div key={group.baseCode} className="text-sm">
                  <span className="font-mono">{group.baseCode}</span>: {' '}
                  {group.variants.map(v => v.variant || '(no variant)').join(', ')}
                </div>
              ))}
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
              disabled={isUploading || groupedProducts.length === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Đang upload...' : 'Upload lên TPOS'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
