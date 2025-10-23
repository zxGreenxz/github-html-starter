import { useState, useRef, useEffect } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

interface ZoomableImageProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}

export function ZoomableImage({ src, alt, size = "md" }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomImageLoaded, setIsZoomImageLoaded] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ top: 0, left: 0 });
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Preload zoom image
  useEffect(() => {
    if (!src || isZoomImageLoaded) return;
    const img = new Image();
    img.src = src;
    img.onload = () => setIsZoomImageLoaded(true);
  }, [src, isZoomImageLoaded]);

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const handleImageClick = async () => {
    if (!src) return;
    
    try {
      // Create a canvas to handle CORS issues
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create blob"));
        }, "image/png");
      });
      
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      
      toast.success("Đã copy ảnh vào clipboard!");
    } catch (error) {
      console.error("Error copying image:", error);
      toast.error("Không thể copy ảnh. Vui lòng thử lại.");
    }
  };

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  const handleMouseEnter = () => {
    if (!imgRef.current || !src) return;
    
    // Clear existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Delay zoom by 300ms
    const timeout = setTimeout(() => {
      if (!imgRef.current) return;
      
      const rect = imgRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const zoomedHeight = 600;
      
      // Calculate position for zoom
      let top = rect.top;
      
      // If zoom would overflow bottom, adjust upward
      if (rect.top + zoomedHeight > viewportHeight) {
        top = viewportHeight - zoomedHeight - 10;
      }
      
      // Ensure zoom doesn't overflow top
      if (top < 10) {
        top = 10;
      }
      
      setZoomPosition({
        top: top,
        left: rect.right + 10
      });
      
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

  if (!src) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded flex items-center justify-center`}>
        <Package className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${sizeClasses[size]} object-cover rounded cursor-zoom-in transition-all duration-200 hover:opacity-80 hover:ring-2 hover:ring-primary hover:ring-offset-1`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
      />
      
      {isZoomed && (
        <div
          className="fixed pointer-events-none z-[9999] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            top: `${zoomPosition.top}px`,
            left: `${zoomPosition.left}px`,
            maxWidth: '600px',
            maxHeight: '600px',
            opacity: isZoomImageLoaded ? 1 : 0
          }}
        >
          {isZoomImageLoaded ? (
            <img
              src={src}
              alt={alt}
              loading="eager"
              className="w-auto h-auto max-w-[600px] max-h-[600px] object-contain rounded-lg shadow-2xl border-2 border-background backdrop-blur-sm"
            />
          ) : (
            <div className="w-[600px] h-[600px] flex items-center justify-center bg-muted/50 rounded-lg">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
