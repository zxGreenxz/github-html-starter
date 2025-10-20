import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, Loader2, Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";

// Global upload lock to prevent multiple simultaneous uploads
let globalUploadInProgress = false;

interface UnifiedImageUploadProps {
  value?: string | string[];
  onChange: (urls: string | string[]) => void;
  maxFiles?: number; // 1 for single, >1 or undefined for multiple
  maxSizeMB?: number;
  bucket: string;
  folder: string;
  placeholder?: string;
  showPreview?: boolean;
  compressThreshold?: number;
}

export function UnifiedImageUpload({
  value,
  onChange,
  maxFiles = 1,
  maxSizeMB = 1,
  bucket,
  folder,
  placeholder,
  showPreview = true,
  compressThreshold = 1,
}: UnifiedImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const images = Array.isArray(value) ? value : value ? [value] : [];
  const isSingle = maxFiles === 1;

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn file hình ảnh");
      return null;
    }

    globalUploadInProgress = true;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      let fileToUpload = file;
      
      // Auto compress if file > threshold
      if (file.size > compressThreshold * 1024 * 1024) {
        setUploadProgress(25);
        fileToUpload = await compressImage(file, maxSizeMB, 1920, 1920);
        setUploadProgress(50);
      } else {
        setUploadProgress(30);
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      setUploadProgress(60);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      setUploadProgress(80);

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setUploadProgress(100);
      
      // Show success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1000);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : "Không thể tải ảnh lên");
      return null;
    } finally {
      globalUploadInProgress = false;
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [bucket, folder, maxSizeMB, compressThreshold]);

  const handleFiles = async (files: FileList | File[]) => {
    if (globalUploadInProgress) {
      toast.info("⏳ Vui lòng đợi upload hiện tại hoàn tất");
      return;
    }

    const fileArray = Array.from(files);
    const imagesToUpload = fileArray.filter(f => f.type.startsWith('image/'));
    
    if (imagesToUpload.length === 0) return;

    // Limit number of files
    const limitedFiles = isSingle ? [imagesToUpload[0]] : imagesToUpload.slice(0, maxFiles || imagesToUpload.length);

    // Upload files (parallel for multiple, single for one)
    if (isSingle) {
      const url = await uploadImage(limitedFiles[0]);
      if (url) {
        onChange(url);
        toast.success("Đã tải ảnh lên");
      }
    } else {
      const uploadPromises = limitedFiles.map(file => uploadImage(file));
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter((url): url is string => url !== null);
      
      if (validUrls.length > 0) {
        onChange([...images, ...validUrls]);
        toast.success(`Đã tải lên ${validUrls.length} ảnh`);
      }
    }
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Block if ANY component is uploading
    if (globalUploadInProgress) {
      e.preventDefault();
      toast.info("⏳ Vui lòng đợi upload hiện tại hoàn tất");
      return;
    }

    // Only process if this component is focused or hovered
    if (!isHovered && !containerRef.current?.contains(document.activeElement)) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await handleFiles(imageFiles);
    }
  }, [handleFiles, isHovered]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
    // Reset input to allow same file upload
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    if (isSingle) {
      onChange('');
    } else {
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages);
    }
  };

  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  }, [handlePaste]);

  return (
    <div>
      {/* Image Previews */}
      {showPreview && images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img 
                src={imageUrl} 
                alt={`Upload ${index + 1}`}
                className="w-24 h-24 object-contain rounded-lg border-2 border-border bg-muted/20 p-1"
                loading="lazy"
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                onClick={() => removeImage(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="button"
        aria-label={placeholder || "Tải ảnh lên. Bạn có thể kéo thả, dán, hoặc click để chọn file"}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative min-h-[160px] p-8 rounded-lg border-2 transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${globalUploadInProgress && !isUploading 
            ? 'opacity-50 cursor-not-allowed pointer-events-none border-dashed border-muted-foreground/20'
            : isDragging 
            ? 'border-primary bg-primary/20 border-solid scale-[1.02] cursor-pointer' 
            : isUploading 
            ? 'border-primary/50 bg-muted/30 border-solid cursor-wait'
            : 'border-dashed border-muted-foreground/30 bg-muted/5 hover:border-primary hover:bg-primary/5 hover:shadow-md cursor-pointer'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={!isSingle}
          onChange={handleFileInputChange}
          className="hidden"
          {...(isMobile ? { capture: "environment" } : {})}
        />

        <div className="flex flex-col items-center justify-center text-center space-y-3">
          {/* Icon */}
          {showSuccess ? (
            <div className="animate-scale-in">
              <Check className="w-12 h-12 text-green-500" />
            </div>
          ) : isUploading ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : isDragging ? (
            <UploadCloud className="w-12 h-12 text-primary animate-bounce" />
          ) : (
            <ImageIcon className="w-12 h-12 text-muted-foreground/60" />
          )}

          {/* Status Text */}
          {isUploading ? (
            <div className="w-full space-y-2">
              <p className="text-sm font-medium text-primary">
                ⬆️ Đang tải... {uploadProgress}%
              </p>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          ) : showSuccess ? (
            <p className="text-sm font-medium text-green-600">
              ✅ Tải lên thành công!
            </p>
          ) : isDragging ? (
            <p className="text-sm font-semibold text-primary">
              👍 Thả ảnh vào đây
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {isMobile ? (
                  <span className="flex items-center gap-1 justify-center">
                    📷 <span>Chọn ảnh từ thư viện</span>
                  </span>
                ) : (
                  placeholder || "Dán ảnh (Ctrl+V) hoặc kéo thả"
                )}
              </p>
              {!isMobile && (
                <p className="text-sm text-muted-foreground">
                  hoặc <span className="font-medium text-primary">Ctrl+V</span> để dán, hoặc{' '}
                  <span className="font-medium text-primary">click</span> để chọn
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-2 border-t border-border/50 pt-2">
                {isSingle ? '1 ảnh' : `Tối đa ${maxFiles} ảnh`} • Tự động nén {'>'}{compressThreshold}MB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
