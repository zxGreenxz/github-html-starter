import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Barcode, Trash2, X, Package, CheckCircle, Loader2 } from "lucide-react";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { formatVietnamTime } from "@/lib/date-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ScannedBarcode {
  code: string;
  timestamp: string;
  productInfo?: {
    name: string;
    image_url?: string;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ScannedBarcodesPanelProps {
  sessionId?: string;
}

export function ScannedBarcodesPanel({ sessionId }: ScannedBarcodesPanelProps) {
  const { 
    scannedBarcodes, 
    clearScannedBarcodes, 
    removeScannedBarcode 
  } = useBarcodeScanner();
  
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const debouncedSearch = useDebounce(manualCode, 300);

  // Fetch product suggestions based on manual input
  const { data: productSuggestions, isLoading: isSuggestionsLoading } = useQuery({
    queryKey: ["product-suggestions", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.trim().length < 2) {
        return [];
      }

      const searchTerm = debouncedSearch.trim();
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, product_name, product_images, tpos_image_url")
        .or(`product_code.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`)
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleManualSubmit = async (code?: string) => {
    const trimmedCode = (code || manualCode).trim().toUpperCase();
    
    if (!trimmedCode) return;
    
    // Just dispatch a single event - the handler will fetch variants
    window.dispatchEvent(
      new CustomEvent('barcode-scanned', { 
        detail: { code: trimmedCode } 
      })
    );
    
    setManualCode("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSubmit();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (productCode: string) => {
    handleManualSubmit(productCode);
  };

  const handleInputBlur = () => {
    // Delay to allow click on suggestion to register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClearAll = () => {
    setShowClearDialog(true);
  };

  const confirmClearAll = async () => {
    await clearScannedBarcodes(sessionId);
    setShowClearDialog(false);
  };

  // ============================================================================
  // RENDER EMPTY STATE
  // ============================================================================

  if (scannedBarcodes.length === 0) {
    return (
      <Card className={cn("border-dashed", isMobile ? "mx-4" : "")}>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="text-center">
            <Barcode 
              className="h-12 w-12 text-muted-foreground mb-3 mx-auto" 
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Chưa có barcode nào được quét
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quét barcode hoặc nhập mã thủ công
            </p>
          </div>
          
          <div className="w-full max-w-sm relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Nhập mã hoặc tên sản phẩm..."
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={handleInputBlur}
                  className="uppercase pr-8"
                  aria-label="Nhập mã sản phẩm thủ công"
                />
                {isSuggestionsLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                onClick={() => handleManualSubmit()}
                disabled={!manualCode.trim()}
                size="sm"
                aria-label="Xác nhận mã sản phẩm"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Xác nhận
              </Button>
            </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && productSuggestions && productSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                <ScrollArea className="max-h-[200px]">
                  <div className="p-1">
                    {productSuggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectSuggestion(product.product_code)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded text-left"
                      >
                        {product.tpos_image_url || (product.product_images && product.product_images[0]) ? (
                          <img
                            src={product.tpos_image_url || product.product_images[0]}
                            alt={product.product_name}
                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.product_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{product.product_code}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // RENDER WITH BARCODES
  // ============================================================================

  return (
    <Card className={isMobile ? "mx-4" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Barcode className="h-4 w-4" aria-hidden="true" />
            Barcode đã quét ({scannedBarcodes.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpand}
              className="h-7 px-2"
              aria-label={isExpanded ? "Thu gọn danh sách" : "Mở rộng danh sách"}
            >
              {isExpanded ? "Thu gọn" : "Mở rộng"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 px-2"
              aria-label="Xóa tất cả barcode"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Nhập mã hoặc tên sản phẩm..."
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={handleInputBlur}
                  className="uppercase pr-8"
                  aria-label="Nhập mã sản phẩm thủ công"
                />
                {isSuggestionsLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                onClick={() => handleManualSubmit()}
                disabled={!manualCode.trim()}
                size="sm"
                aria-label="Xác nhận mã sản phẩm"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Xác nhận
              </Button>
            </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && productSuggestions && productSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                <ScrollArea className="max-h-[200px]">
                  <div className="p-1">
                    {productSuggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectSuggestion(product.product_code)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded text-left"
                      >
                        {product.tpos_image_url || (product.product_images && product.product_images[0]) ? (
                          <img
                            src={product.tpos_image_url || product.product_images[0]}
                            alt={product.product_name}
                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.product_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{product.product_code}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {scannedBarcodes.map((barcode: ScannedBarcode, index: number) => (
                <div
                  key={`${barcode.code}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  {barcode.productInfo?.image_url ? (
                    <img
                      src={barcode.productInfo.image_url}
                      alt={barcode.productInfo.name}
                      className="w-12 h-12 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-medium truncate">
                          {barcode.code}
                        </p>
                        {barcode.productInfo ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {barcode.productInfo.name}
                          </p>
                        ) : (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Không tìm thấy sản phẩm
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeScannedBarcode(barcode.code)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                        aria-label={`Xóa barcode ${barcode.code}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatVietnamTime(barcode.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tất cả</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa tất cả {scannedBarcodes.length} barcode đã quét?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}