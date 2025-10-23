import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileMapping {
  file: File;
  productCode: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'warning';
  errorMessage?: string;
  previewUrl: string;
  exists?: boolean;
  isEditing?: boolean;
}

interface BulkUploadImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Extract product code from filename
function extractProductCodeFromFilename(filename: string): string | null {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  
  // Pattern 1: Simple code (A43, LQU53A4, etc.)
  if (/^[A-Z0-9]+$/.test(nameWithoutExt)) {
    return nameWithoutExt;
  }
  
  // Pattern 2: Code with separator (A43_main.jpg → A43)
  const match = nameWithoutExt.match(/^([A-Z0-9]+)[_-]/);
  if (match) return match[1];
  
  return null;
}

export function BulkUploadImagesDialog({
  open,
  onOpenChange,
  onSuccess
}: BulkUploadImagesDialogProps) {
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, warning: 0 });

  const handleFilesSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const mappings: FileMapping[] = [];

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} không phải là file ảnh`);
        continue;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} vượt quá 5MB`);
        continue;
      }

      const productCode = extractProductCodeFromFilename(file.name);
      const previewUrl = URL.createObjectURL(file);

      mappings.push({
        file,
        productCode: productCode || '',
        status: productCode ? 'pending' : 'warning',
        errorMessage: productCode ? undefined : 'Không tự động match được mã SP',
        previewUrl,
        isEditing: false
      });
    }

    // Check which product codes exist
    if (mappings.length > 0) {
      const productCodes = mappings
        .filter(m => m.productCode)
        .map(m => m.productCode);
      
      if (productCodes.length > 0) {
        const { data: existingProducts } = await supabase
          .from('products')
          .select('product_code')
          .in('product_code', productCodes)
          .not('tpos_product_id', 'is', null); // Only parent products

        const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);

        mappings.forEach(mapping => {
          if (mapping.productCode) {
            mapping.exists = existingCodes.has(mapping.productCode);
            if (!mapping.exists && mapping.status === 'pending') {
              mapping.status = 'warning';
              mapping.errorMessage = 'Mã SP không tồn tại hoặc không phải sản phẩm cha';
            }
          }
        });
      }
    }

    setFileMappings(prev => [...prev, ...mappings]);
  };

  const handleEditProductCode = (index: number, newCode: string) => {
    setFileMappings(prev => prev.map((m, i) => 
      i === index ? { ...m, productCode: newCode.toUpperCase() } : m
    ));
  };

  const toggleEdit = (index: number) => {
    setFileMappings(prev => prev.map((m, i) => 
      i === index ? { ...m, isEditing: !m.isEditing } : m
    ));
  };

  const removeFile = (index: number) => {
    setFileMappings(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUploadAll = async () => {
    const validMappings = fileMappings.filter(m => m.exists && m.productCode);
    
    if (validMappings.length === 0) {
      toast.error("Không có file nào hợp lệ để upload");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let successCount = 0;
    let failedCount = 0;

    // Upload in batches of 5
    const batchSize = 5;
    for (let i = 0; i < validMappings.length; i += batchSize) {
      const batch = validMappings.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (mapping, batchIndex) => {
          const actualIndex = fileMappings.indexOf(mapping);
          
          // Update status to uploading
          setFileMappings(prev => prev.map((m, idx) => 
            idx === actualIndex ? { ...m, status: 'uploading' as const } : m
          ));

          try {
            // Upload to storage
            const fileExt = mapping.file.name.split('.').pop();
            const fileName = `${mapping.productCode}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('tpos-images')
              .upload(fileName, mapping.file, {
                contentType: mapping.file.type,
                upsert: false
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('tpos-images')
              .getPublicUrl(fileName);

            // Update product
            const { error: updateError } = await supabase
              .from('products')
              .update({ tpos_image_url: publicUrl })
              .eq('product_code', mapping.productCode);

            if (updateError) {
              // Rollback: delete uploaded file
              await supabase.storage
                .from('tpos-images')
                .remove([fileName]);
              throw updateError;
            }

            // Update status to success
            setFileMappings(prev => prev.map((m, idx) => 
              idx === actualIndex ? { ...m, status: 'success' as const } : m
            ));

            successCount++;
            return { success: true };
          } catch (error: any) {
            // Update status to error
            setFileMappings(prev => prev.map((m, idx) => 
              idx === actualIndex ? { 
                ...m, 
                status: 'error' as const,
                errorMessage: error.message 
              } : m
            ));

            failedCount++;
            return { success: false, error: error.message };
          }
        })
      );

      // Update progress
      const completed = i + batch.length;
      setUploadProgress(Math.round((completed / validMappings.length) * 100));
    }

    const warningCount = fileMappings.filter(m => m.status === 'warning').length;

    setStats({ 
      total: fileMappings.length, 
      success: successCount, 
      failed: failedCount,
      warning: warningCount
    });

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Đã upload ${successCount} ảnh thành công`);
      onSuccess();
    }

    if (failedCount > 0) {
      toast.error(`${failedCount} ảnh upload thất bại`);
    }
  };

  const resetDialog = () => {
    fileMappings.forEach(m => URL.revokeObjectURL(m.previewUrl));
    setFileMappings([]);
    setUploadProgress(0);
    setStats({ total: 0, success: 0, failed: 0, warning: 0 });
  };

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  const validCount = fileMappings.filter(m => m.exists && m.productCode).length;
  const hasUploaded = stats.success > 0 || stats.failed > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Ảnh Hàng Loạt</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File Input */}
          {!isUploading && (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelect}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Tên file phải là mã sản phẩm (VD: A43.jpg, LQU53A4.png) - JPG, PNG, GIF - Tối đa 5MB/ảnh
              </p>
            </div>
          )}

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Đang upload: {uploadProgress}%
              </p>
            </div>
          )}

          {/* Summary Stats */}
          {hasUploaded && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Tổng files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-xs text-muted-foreground">Thành công</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Thất bại</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
                <div className="text-xs text-muted-foreground">Cảnh báo</div>
              </div>
            </div>
          )}

          {/* File Mapping Table */}
          {fileMappings.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Preview</TableHead>
                    <TableHead>Tên file</TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <img 
                          src={mapping.previewUrl} 
                          alt={mapping.file.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      </TableCell>
                      <TableCell className="text-sm">{mapping.file.name}</TableCell>
                      <TableCell>
                        {mapping.isEditing ? (
                          <Input
                            value={mapping.productCode}
                            onChange={(e) => handleEditProductCode(index, e.target.value)}
                            className="h-8 w-32"
                            onBlur={() => toggleEdit(index)}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{mapping.productCode || '-'}</span>
                            {!isUploading && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEdit(index)}
                                className="h-6 w-6 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mapping.status === 'pending' && (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-xs">Sẵn sàng</span>
                            </>
                          )}
                          {mapping.status === 'uploading' && (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-xs">Đang upload...</span>
                            </>
                          )}
                          {mapping.status === 'success' && (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-xs text-green-600">Thành công</span>
                            </>
                          )}
                          {mapping.status === 'error' && (
                            <>
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span className="text-xs text-red-600">{mapping.errorMessage}</span>
                            </>
                          )}
                          {mapping.status === 'warning' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              <span className="text-xs text-yellow-600">{mapping.errorMessage}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {!isUploading && mapping.status !== 'uploading' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            ×
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-between items-center pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {validCount > 0 && `${validCount} file hợp lệ sẵn sàng upload`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetDialog();
                }}
                disabled={isUploading}
              >
                {hasUploaded ? 'Đóng' : 'Hủy'}
              </Button>
              {!hasUploaded && (
                <Button
                  onClick={handleUploadAll}
                  disabled={validCount === 0 || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang upload...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {validCount > 0 && `(${validCount})`}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
