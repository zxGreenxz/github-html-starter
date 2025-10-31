import { useEffect } from 'react';
import { compressImage } from '@/lib/image-utils';

/**
 * Hook để xử lý paste ảnh từ clipboard (Ctrl+V)
 * Converts pasted images to Base64 data URL format with 72 DPI normalization
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
            try {
              // Compress to normalize DPI to 72
              console.log('🔄 Compressing pasted image to 72 DPI...');
              const file = new File([blob], 'pasted-image.jpg', { type: blob.type });
              const compressedFile = await compressImage(file, 1, 1920, 1920);
              
              // Convert compressed file to base64
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result as string;
                console.log('✅ Image compressed and ready');
                onImagePaste(base64);
              };
              reader.readAsDataURL(compressedFile);
            } catch (error) {
              console.error('Error compressing pasted image:', error);
              // Fallback: use original if compression fails
              const reader = new FileReader();
              reader.onload = () => {
                onImagePaste(reader.result as string);
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onImagePaste, enabled]);
}
