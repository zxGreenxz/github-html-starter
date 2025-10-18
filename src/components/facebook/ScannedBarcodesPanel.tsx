import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Barcode, Trash2, X, Package, CheckCircle } from "lucide-react";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

export function ScannedBarcodesPanel() {
  const { 
    scannedBarcodes, 
    clearScannedBarcodes, 
    removeScannedBarcode 
  } = useBarcodeScanner();
  
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(true);
  const [manualCode, setManualCode] = useState("");

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleManualSubmit = () => {
    const trimmedCode = manualCode.trim();
    
    if (!trimmedCode) return;
    
    // Dispatch the same barcode-scanned event
    window.dispatchEvent(
      new CustomEvent('barcode-scanned', { 
        detail: { code: trimmedCode } 
      })
    );
    
    setManualCode("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClearAll = () => {
    if (scannedBarcodes.length > 0) {
      if (confirm(`Bạn có chắc muốn xóa tất cả ${scannedBarcodes.length} barcode?`)) {
        clearScannedBarcodes();
      }
    }
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
          
          <div className="flex gap-2 w-full max-w-sm">
            <Input
              placeholder="Nhập mã sản phẩm..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              aria-label="Nhập mã sản phẩm thủ công"
            />
            <Button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              size="sm"
              aria-label="Xác nhận mã sản phẩm"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Xác nhận
            </Button>
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
          <div className="flex gap-2">
            <Input
              placeholder="Nhập mã sản phẩm..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              aria-label="Nhập mã sản phẩm thủ công"
            />
            <Button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              size="sm"
              aria-label="Xác nhận mã sản phẩm"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Xác nhận
            </Button>
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
                      {format(new Date(barcode.timestamp), 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}