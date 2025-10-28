import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Search, RefreshCw, Package } from "lucide-react";
import { searchTPOSProduct, importProductFromTPOS, TPOSProductSearchResult } from "@/lib/tpos-api";
import { toast } from "sonner";
import { formatVND } from "@/lib/currency-utils";

interface SearchSyncTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductSynced: (product: any) => void;
  onSuccess: () => void;
}

export function SearchSyncTPOSDialog({
  open,
  onOpenChange,
  onProductSynced,
  onSuccess,
}: SearchSyncTPOSDialogProps) {
  const [productCode, setProductCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchResult, setSearchResult] = useState<TPOSProductSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!productCode.trim()) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      console.log("🔍 Searching for product:", productCode.trim());
      const result = await searchTPOSProduct(productCode.trim());

      if (!result) {
        setError(`Không tìm thấy sản phẩm với mã: ${productCode.trim()}`);
        setSearchResult(null);
        toast.error("Không tìm thấy sản phẩm trong TPOS");
      } else {
        setSearchResult(result);
        toast.success("Đã tìm thấy sản phẩm từ TPOS");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      const errorMsg = err.message || "Lỗi khi tìm kiếm sản phẩm";
      setError(errorMsg);
      setSearchResult(null);
      toast.error(errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSync = async () => {
    if (!searchResult) return;

    setIsSyncing(true);

    try {
      console.log("🔄 Syncing product from TPOS:", searchResult.DefaultCode);
      const syncedProduct = await importProductFromTPOS(searchResult);

      toast.success(
        syncedProduct.isUpdated
          ? "Đã cập nhật thông tin từ TPOS"
          : "Đã thêm sản phẩm mới từ TPOS"
      );

      // Call onSuccess to refetch products list
      onSuccess();

      // Pass the synced product to open EditProductDialog
      // syncedProduct is { ...productData, isUpdated: boolean }
      const { isUpdated, ...productData } = syncedProduct;
      onProductSynced(productData);

      // Reset state and close dialog
      setProductCode("");
      setSearchResult(null);
      setError(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Không thể đồng bộ sản phẩm", {
        description: "Vui lòng thử lại"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    if (!isSearching && !isSyncing) {
      setProductCode("");
      setSearchResult(null);
      setError(null);
      onOpenChange(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching && productCode.trim()) {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Đồng bộ sản phẩm từ TPOS</DialogTitle>
          <DialogDescription>
            Tìm kiếm sản phẩm bằng mã, tải thông tin mới nhất từ TPOS và cập nhật vào hệ thống
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="productCode">Mã sản phẩm</Label>
            <div className="flex gap-2">
              <Input
                id="productCode"
                placeholder="Nhập mã sản phẩm (ví dụ: SP001)"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSearching || isSyncing}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || isSyncing || !productCode.trim()}
                className="gap-2"
              >
                {isSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isSearching ? "Đang tìm..." : "Tìm kiếm"}
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Card className="p-4 border-destructive bg-destructive/10">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}

          {/* Search Result */}
          {searchResult && (
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="font-semibold text-lg">{searchResult.Name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Mã: {searchResult.DefaultCode}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Giá bán:</span>
                      <p className="font-medium">{formatVND(searchResult.ListPrice)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Giá mua:</span>
                      <p className="font-medium">{formatVND(searchResult.StandardPrice)}</p>
                    </div>
                    {searchResult.Barcode && (
                      <div>
                        <span className="text-muted-foreground">Barcode:</span>
                        <p className="font-medium">{searchResult.Barcode}</p>
                      </div>
                    )}
                    {searchResult.UOMName && (
                      <div>
                        <span className="text-muted-foreground">Đơn vị:</span>
                        <p className="font-medium">{searchResult.UOMName}</p>
                      </div>
                    )}
                  </div>

                  {searchResult.ImageUrl && (
                    <div className="mt-2">
                      <img
                        src={searchResult.ImageUrl}
                        alt={searchResult.Name}
                        className="w-32 h-32 object-cover rounded-md border"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {!searchResult && !error && !isSearching && (
            <Card className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nhập mã sản phẩm và nhấn "Tìm kiếm"</p>
              <p className="text-sm mt-1">
                Thông tin sẽ được tải từ TPOS và cập nhật vào hệ thống
              </p>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSearching || isSyncing}
          >
            Hủy
          </Button>
          {searchResult && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Đồng bộ & Sửa
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
