import { useState, useEffect, useRef } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { fetchAndSaveTPOSImage, getProductImageUrl, getParentImageUrl } from "@/lib/tpos-image-loader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useImageBlob } from "@/hooks/use-image-blob";

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
  const [zoomPosition, setZoomPosition] = useState({ top: 0, left: 0 });
  const [parentImageUrl, setParentImageUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Fetch parent image if this is a child product
    const fetchParentImage = async () => {
      if (baseProductCode && baseProductCode !== productCode) {
        const parentImg = await getParentImageUrl(productCode, baseProductCode);
        setParentImageUrl(parentImg);
      }
    };
    
    fetchParentImage();
  }, [productCode, baseProductCode]);

  useEffect(() => {
    // Get initial image URL based on priority (including parent image)
    const initialUrl = getProductImageUrl(
      productImages || null, 
      tposImageUrl || null,
      parentImageUrl
    );
    
    if (initialUrl) {
      setImageUrl(initialUrl);
    } else if (tposProductId && !isLoading) {
      // No image available, fetch from TPOS (one-time only)
      setIsLoading(true);
      fetchAndSaveTPOSImage(productId, productCode, tposProductId)
        .then((url) => {
          if (url) {
            setImageUrl(url);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [productId, productCode, productImages, tposImageUrl, tposProductId, parentImageUrl]);

  // Convert to blob for CORS-free interaction
  const displayUrl = useImageBlob(imageUrl);

  const handleMouseEnter = () => {
    if (!imgRef.current || !displayUrl) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const zoomedHeight = 600;
    
    // Check if zoomed image would be cut off at bottom
    const wouldOverflowBottom = rect.top + zoomedHeight > viewportHeight;
    
    // Check if positioning above would cut off at top
    const wouldOverflowTop = rect.bottom - zoomedHeight < 0;
    
    // Determine vertical position
    let top = 0; // default: align with thumbnail top
    
    if (wouldOverflowBottom && !wouldOverflowTop) {
      // Position above thumbnail if cut off at bottom and won't overflow top
      top = -(zoomedHeight - rect.height);
    }
    
    setZoomPosition({ top, left: 0 });
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
  };

  const handleImageClick = async () => {
    if (!displayUrl) return;
    
    try {
      // Fetch image as blob (displayUrl might already be blob URL)
      const response = await fetch(displayUrl);
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
        await navigator.clipboard.writeText(displayUrl);
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

  if (!displayUrl) {
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
        src={displayUrl}
        alt={productCode}
        className="w-10 h-10 object-cover rounded cursor-pointer transition-opacity duration-200 hover:opacity-80"
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
          className="absolute pointer-events-none z-[99999] left-[calc(100%+10px)]"
          style={{
            top: `${zoomPosition.top}px`,
            maxWidth: '600px',
            maxHeight: '600px'
          }}
        >
          <img
            src={displayUrl}
            alt={productCode}
            className="w-auto h-auto max-w-[600px] max-h-[600px] object-contain rounded-lg shadow-2xl border-4 border-background"
          />
        </div>
      )}
    </div>
  );
}
