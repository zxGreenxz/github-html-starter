import { useState, useEffect } from "react";

/**
 * Detect if URL is from TPOS API
 */
function isTPOSUrl(url: string): boolean {
  return url.includes('s3.me-south-1.') || 
         url.includes('tpos.') || 
         url.includes('api.tpos.vn');
}

/**
 * Convert image URL to blob URL for CORS-safe display and interaction
 * Auto-detects TPOS URLs and converts them to blob
 * Non-TPOS URLs (like Supabase) are returned as-is
 */
export function useImageBlob(imageUrl: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    // Reset if no URL
    if (!imageUrl) {
      setBlobUrl(null);
      return;
    }

    // If not TPOS URL, use directly
    if (!isTPOSUrl(imageUrl)) {
      setBlobUrl(imageUrl);
      return;
    }

    // Convert TPOS URL to blob
    let mounted = true;

    fetch(imageUrl)
      .then(response => {
        if (!response.ok) throw new Error("Failed to fetch image");
        return response.blob();
      })
      .then(blob => {
        if (mounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      })
      .catch(error => {
        console.error("Error converting image to blob:", error);
        if (mounted) {
          // Fallback to original URL on error
          setBlobUrl(imageUrl);
        }
      });

    // Cleanup function
    return () => {
      mounted = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [imageUrl]);

  return blobUrl;
}
