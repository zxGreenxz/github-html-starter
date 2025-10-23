import { useState, useEffect, useRef } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { fetchAndSaveTPOSImage, getProductImageUrl, getParentImageUrl } from "@/lib/tpos-image-loader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProductImageProps {
  productId: string;
  productCode: string;
  productImages?: string[] | null;
  tposImageUrl?: string | null;
  tposProductId?: number | null;
  baseProductCode?: string | null;
}

export function ProductImage({
  productId,
  productCode,
  productImages,
  tposImageUrl,
  tposProductId,
  baseProductCode,
}: ProductImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomImageLoaded, setIsZoomImageLoaded] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ top: 0, left: 0 });
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Merged: Load parent image & determine URL
  useEffect(() => {
    let isMounted = true;
    
    const loadImage = async () => {
      // Step 1: Check parent image if needed
      let parentImg: string | null = null;
      if (baseProductCode && baseProductCode !== productCode) {
        parentImg = await getParentImageUrl(productCode, baseProductCode);
      }
      
      if (!isMounted) return;
      
      // Step 2: Determine initial URL
      const initialUrl = getProductImageUrl(
        productImages || null,
        tposImageUrl || null,
        parentImg
      );
      
      if (initialUrl) {
        setImageUrl(initialUrl);
      } else if (tposProductId && !isLoading) {
        // Step 3: Fetch from TPOS (one-time only)
        setIsLoading(true);
        const url = await fetchAndSaveTPOSImage(productId, productCode, tposProductId);
        if (isMounted && url) {
          setImageUrl(url);
        }
        setIsLoading(false);
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [productId, productCode, productImages, tposImageUrl, tposProductId, baseProductCode]);

  // Preload zoom image on hover
  useEffect(() => {
    if (!imageUrl || isZoomImageLoaded) return;
    
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => setIsZoomImageLoaded(true);
  }, [imageUrl, isZoomImageLoaded]);

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const handleMouseEnter = () => {
    if (!imgRef.current || !imageUrl) return;
    
    // Clear existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Delay zoom by 300ms to avoid accidental hover
    const timeout = setTimeout(() => {
      if (!imgRef.current) return;
      
      const rect = imgRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const zoomedHeight = 600;
      
      // Default: align top of zoom with top of thumbnail
      let top = 0;
      
      // Check if zoom would overflow viewport bottom
      const wouldOverflowBottom = rect.top + zoomedHeight > viewportHeight;
      
      // If overflow bottom, shift zoom up
      if (wouldOverflowBottom) {
        // Calculate how much to shift up to fit in viewport
        const overflowAmount = (rect.top + zoomedHeight) - viewportHeight;
        top = -overflowAmount - 10; // -10px for padding from bottom
        
        // But don't shift so far up that zoom goes above viewport top
        const minTop = -rect.top + 10; // Keep 10px from top
        if (top < minTop) {
          top = minTop;
        }
      }
      
      setZoomPosition({ top, left: 0 });
      setIsZoomed(true);
    }, 300);
    
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsZoomed(false);
  };

  const handleImageClick = async () => {
    if (!imageUrl) return;
    
    try {
      // Try to fetch image as blob to bypass CORS
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      
      const blob = await response.blob();
      
      // Create image from blob URL
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
      
      // Draw to canvas and convert to PNG
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Could not get canvas context");
      }
      
      ctx.drawImage(img, 0, 0);
      
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
      
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create blob"));
        }, "image/png");
      });
      
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ]);
      
      toast.success("Đã copy ảnh vào clipboard!");
    } catch (error) {
      console.error("Error copying image:", error);
      
      // Fallback: Copy image URL to clipboard if image copy fails
      try {
        await navigator.clipboard.writeText(imageUrl);
        toast.success("Không thể copy ảnh. Đã copy link ảnh vào clipboard!");
      } catch (urlError) {
        toast.error("Không thể copy. Vui lòng thử lại.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-10 h-10 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <img
        ref={imgRef}
        src={imageUrl}
        alt={productCode}
        loading="lazy"
        decoding="async"
        className="w-10 h-10 object-cover rounded cursor-zoom-in transition-all duration-200 hover:opacity-80 hover:ring-2 hover:ring-primary hover:ring-offset-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
        }}
      />
      <div className="w-10 h-10 hidden fallback-icon flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      {isZoomed && (
        <div
          className="absolute pointer-events-none z-[99999] left-[calc(100%+10px)] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            top: `${zoomPosition.top}px`,
            maxWidth: '600px',
            maxHeight: '600px',
            opacity: isZoomImageLoaded ? 1 : 0
          }}
        >
          {isZoomImageLoaded ? (
            <img
              src={imageUrl}
              alt={productCode}
              loading="eager"
              className="w-auto h-auto max-w-[600px] max-h-[600px] object-contain rounded-lg shadow-2xl border-2 border-background backdrop-blur-sm"
            />
          ) : (
            <div className="w-[600px] h-[600px] flex items-center justify-center bg-muted/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
