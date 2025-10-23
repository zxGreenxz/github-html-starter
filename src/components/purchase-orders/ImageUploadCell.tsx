import { UnifiedImageUpload } from "@/components/ui/unified-image-upload";

interface ImageUploadCellProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  itemIndex: number;
  disabled?: boolean;
}

export function ImageUploadCell({ images, onImagesChange, itemIndex, disabled = false }: ImageUploadCellProps) {
  if (disabled) {
    return (
      <div className="flex gap-1">
        {images && images.length > 0 ? (
          images.map((url, idx) => (
            <img 
              key={idx} 
              src={url} 
              alt="" 
              loading="lazy"
              decoding="async"
              className="w-12 h-12 object-cover rounded border" 
            />
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Không có ảnh</span>
        )}
      </div>
    );
  }

  return (
    <UnifiedImageUpload
      value={images}
      onChange={onImagesChange}
      maxFiles={1}
      bucket="purchase-images"
      folder="purchase-order-items"
      placeholder="Dán ảnh (Ctrl+V)"
      showPreview={true}
      preventMultiple={true}
      customHeight="50px"
    />
  );
}