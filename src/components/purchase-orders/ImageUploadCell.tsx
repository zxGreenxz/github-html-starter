import { UnifiedImageUpload } from "@/components/ui/unified-image-upload";

interface ImageUploadCellProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  itemIndex: number;
}

export function ImageUploadCell({ images, onImagesChange, itemIndex }: ImageUploadCellProps) {
  return (
    <UnifiedImageUpload
      value={images}
      onChange={onImagesChange}
      maxFiles={10}
      bucket="purchase-images"
      folder="purchase-order-items"
      placeholder="Dán ảnh (Ctrl+V) hoặc kéo thả"
      showPreview={true}
    />
  );
}