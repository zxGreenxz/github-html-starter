import { UnifiedImageUpload } from "@/components/ui/unified-image-upload";

interface ImageUploadCellProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  itemIndex: number;
  disabled?: boolean;
  imageCache?: Map<string, string>; // ✅ NEW
  onCacheUpdate?: (url: string, base64: string) => void; // ✅ NEW
}

export function ImageUploadCell({
  images,
  onImagesChange,
  itemIndex,
  disabled = false,
  imageCache,
  onCacheUpdate
}: ImageUploadCellProps) {
  if (disabled) {
    return (
      <div className="flex gap-1">
        {images && images.length > 0 ? (
          images.map((url, idx) => (
            <img key={idx} src={url} alt="" className="w-12 h-12 object-cover rounded border" />
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Không có ảnh</span>
        )}
      </div>
    );
  }

  // ✅ Wrap onChange to auto-cache new URLs
  const handleImagesChange = async (newImages: string[]) => {
    // Call original onChange first
    onImagesChange(newImages);

    // Auto-cache new URLs
    if (imageCache && onCacheUpdate) {
      const newUrls = newImages.filter(url => url && !imageCache.has(url));

      if (newUrls.length > 0) {
        console.log(`🔄 Auto-caching ${newUrls.length} new image(s)...`);

        // Cache in parallel
        newUrls.forEach(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              console.warn(`Failed to fetch image: ${url}`);
              return;
            }

            const blob = await response.blob();

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1]; // Remove data:image/...;base64, prefix
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            onCacheUpdate(url, base64);
            console.log(`✅ Auto-cached: ${url.substring(0, 50)}...`);
          } catch (error) {
            console.error('Error auto-caching image:', error);
          }
        });
      }
    }
  };

  return (
    <UnifiedImageUpload
      value={images}
      onChange={handleImagesChange}
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