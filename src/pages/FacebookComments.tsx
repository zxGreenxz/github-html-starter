import { MessageSquare, Barcode } from "lucide-react";
import { FacebookCommentsManager } from "@/components/facebook/FacebookCommentsManager";
import { CommentsSidebar } from "@/components/live-products/CommentsSidebar";
import { ScannedBarcodesPanel } from "@/components/facebook/ScannedBarcodesPanel";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { fetchProductVariants, fetchProductsByCode } from "@/lib/product-variants-fetcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FacebookComments = () => {
  const { isCommentsOpen, setIsCommentsOpen } = useCommentsSidebar();
  const { addScannedBarcode, scannedBarcodes } = useBarcodeScanner();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isBarcodePanelOpen, setIsBarcodePanelOpen] = useState(false);

  // Handle barcode scanning with variants
  useEffect(() => {
    const handleBarcodeScanned = async (event: CustomEvent) => {
      const code = event.detail.code;
      
      try {
        // Find the scanned product
        const { data: product, error } = await supabase
          .from('products')
          .select('*')
          .or(`product_code.eq.${code},barcode.eq.${code}`)
          .maybeSingle();
        
        if (error) throw error;
        
        if (!product) {
          toast({
            title: "❌ Không tìm thấy sản phẩm",
            description: `Mã: ${code}`,
            variant: "destructive",
          });
          return;
        }

        // Call addScannedBarcode once - it will handle fetching and adding all variants
        await addScannedBarcode({
          code: product.product_code,
          timestamp: new Date().toISOString(),
          productInfo: {
            id: product.id,
            name: product.product_name,
            image_url: product.product_images?.[0] || product.tpos_image_url,
            product_code: product.product_code,
          }
        });
        
        // Show success toast
        const variantCodes = await fetchProductVariants(product.product_code);
        if (variantCodes.length > 1) {
          toast({
            title: "✅ Đã thêm tất cả biến thể",
            description: `${variantCodes.length} sản phẩm: ${product.product_name}`,
          });
        } else {
          toast({
            title: "✅ Đã thêm sản phẩm",
            description: product.product_name,
          });
        }
      } catch (error) {
        console.error('Error handling barcode:', error);
        toast({
          title: "❌ Lỗi",
          description: "Không thể xử lý barcode",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('barcode-scanned' as any, handleBarcodeScanned as any);
    return () => {
      window.removeEventListener('barcode-scanned' as any, handleBarcodeScanned as any);
    };
  }, [addScannedBarcode, toast]);

  return (
    <div className={cn(
      "transition-all duration-300 ease-in-out",
      isCommentsOpen && !isMobile ? "mr-[450px]" : "mr-0"
    )}>
      <div className={cn(
        "mx-auto space-y-6",
        isMobile ? "p-4" : "container p-6"
      )}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <MessageSquare 
              className={cn(
                "text-primary",
                isMobile ? "h-5 w-5" : "h-6 w-6"
              )}
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className={cn(
              "font-bold text-foreground",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              Livestream Comment
            </h1>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Quản lý comment và đơn hàng từ Facebook Live
            </p>
          </div>
        </div>

        {/* Facebook Comments Manager */}
        <FacebookCommentsManager />
      </div>

      {/* Comments Sidebar */}
      <CommentsSidebar 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)}
      >
        <div className="p-4 text-center text-muted-foreground">
          Chọn video từ Facebook Comments Manager để xem comments ở đây
        </div>
      </CommentsSidebar>

      {/* Floating Toggle Button */}
      <Button
        onClick={() => setIsBarcodePanelOpen(!isBarcodePanelOpen)}
        className={cn(
          "fixed z-40 shadow-lg",
          isMobile ? "bottom-20 right-4" : "bottom-6 right-6",
          "bg-purple-600 hover:bg-purple-700 text-white"
        )}
        size={isMobile ? "default" : "lg"}
      >
        <Barcode className="h-5 w-5 mr-2" />
        Barcode
        {scannedBarcodes.length > 0 && (
          <Badge className="ml-2 bg-amber-500 text-white">
            {scannedBarcodes.length}
          </Badge>
        )}
      </Button>

      {/* Scanned Barcodes Panel - Bottom Fixed */}
      {isBarcodePanelOpen && (
        <div className={cn(
          "fixed z-30 left-0 right-0 bg-background border-t shadow-2xl animate-in slide-in-from-bottom duration-300",
          isMobile ? "bottom-0 max-h-[60vh]" : "bottom-0 max-h-[50vh]",
          isCommentsOpen && !isMobile ? "right-[450px]" : "right-0"
        )}>
          <ScannedBarcodesPanel />
        </div>
      )}
    </div>
  );
};

export default FacebookComments;