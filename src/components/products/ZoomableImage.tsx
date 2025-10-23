import { useState, useRef } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useImageBlob } from "@/hooks/use-image-blob";

interface ZoomableImageProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}

export function ZoomableImage({ src, alt, size = "md" }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ top: 0, left: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Convert to blob for CORS-free interaction
  const displayUrl = useImageBlob(src);

  const handleImageClick = async () => {
    if (!displayUrl) return;
    
    try {
      // Fetch image as blob (displayUrl might already be blob URL)
      const response = await fetch(displayUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      
      const blob = await response.blob();
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
      
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
      
      // Convert canvas to blob
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
      toast.error("Không thể copy ảnh. Vui lòng thử lại.");
    }
  };

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  const handleMouseEnter = () => {
    if (!imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const zoomedHeight = 600; // Approximate zoomed image height
    
    // Calculate vertical position
    let top = rect.top;
    
    // If zoomed image would overflow bottom, align to bottom edge of original image
    if (rect.top + zoomedHeight > viewportHeight) {
      top = rect.bottom - zoomedHeight;
    }
    
    // If still overflows top, align to top edge of original image
    if (top < 0) {
      top = rect.top;
    }
    
    setZoomPosition({
      top: top,
      left: rect.right + 10 // 10px gap from original image
    });
    
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
  };

  if (!displayUrl) {
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
        src={displayUrl}
        alt={alt}
        className={`${sizeClasses[size]} object-cover rounded cursor-pointer transition-opacity duration-200 hover:opacity-80`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
      />
      
      {isZoomed && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            top: `${zoomPosition.top}px`,
            left: `${zoomPosition.left}px`,
            maxWidth: '600px',
            maxHeight: '600px'
          }}
          onMouseEnter={handleMouseLeave}
        >
          <img
            src={displayUrl}
            alt={alt}
            className="w-auto h-auto max-w-[600px] max-h-[600px] object-contain rounded-lg shadow-2xl border-4 border-background"
          />
        </div>
      )}
    </div>
  );
}
