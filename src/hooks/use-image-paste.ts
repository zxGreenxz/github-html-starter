import { useEffect } from 'react';

/**
 * Hook để xử lý paste ảnh từ clipboard (Ctrl+V)
 * Converts pasted images to Base64 data URL format
 */
export function useImagePaste(
  onImagePaste: (base64: string) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              onImagePaste(base64);
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onImagePaste, enabled]);
}
