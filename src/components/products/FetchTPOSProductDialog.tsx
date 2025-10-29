import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Edit } from "lucide-react";
import { toast } from "sonner";
import { searchTPOSProductByCode, getTPOSProductFullDetails, type TPOSProductFullDetails } from "@/lib/tpos-api";
import { EditTPOSProductDialog } from "./EditTPOSProductDialog";
import { SelectProductDialog } from "./SelectProductDialog";
import { Input } from "@/components/ui/input";

interface FetchTPOSProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FetchTPOSProductDialog({ open, onOpenChange }: FetchTPOSProductDialogProps) {
  const [productCode, setProductCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedProduct, setFetchedProduct] = useState<TPOSProductFullDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSelectDialogOpen, setIsSelectDialogOpen] = useState(false);
  
  const handleFetch = async () => {
    const trimmedCode = productCode.trim();
    
    if (!trimmedCode) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setFetchedProduct(null);
    
    try {
      console.log(`🔍 Searching for: ${trimmedCode}`);
      const searchResult = await searchTPOSProductByCode(trimmedCode);
      
      if (!searchResult) {
        throw new Error(`Không tìm thấy sản phẩm với mã: ${trimmedCode}`);
      }
      
      console.log(`📦 Fetching full details for ID: ${searchResult.Id}`);
      const details = await getTPOSProductFullDetails(searchResult.Id);
      
      setFetchedProduct(details);
      toast.success(`Đã tìm thấy: ${details.Name}`);
      
    } catch (err: any) {
      console.error('❌ Error fetching product:', err);
      const errorMessage = err.message || "Không thể lấy thông tin sản phẩm";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lấy sản phẩm từ TPOS</DialogTitle>
            <DialogDescription>
              Nhập mã sản phẩm (DefaultCode) để lấy thông tin từ TPOS
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={productCode}
                  readOnly
                  placeholder="Chọn sản phẩm từ kho..."
                  className="flex-1 cursor-pointer"
                  onClick={() => setIsSelectDialogOpen(true)}
                />
                <Button 
                  onClick={handleFetch} 
                  disabled={isLoading || !productCode.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang tìm...
                    </>
                  ) : (
                    "Thêm"
                  )}
                </Button>
              </div>
              {productCode && (
                <div className="text-sm text-muted-foreground">
                  Đã chọn: <span className="font-medium">{productCode}</span>
                </div>
              )}
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {fetchedProduct && (
              <Card>
                <CardHeader>
                  <CardTitle>{fetchedProduct.Name}</CardTitle>
                  <CardDescription>
                    Mã: {fetchedProduct.DefaultCode} | ID: {fetchedProduct.Id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Giá bán</p>
                      <p className="font-semibold text-lg">
                        {fetchedProduct.ListPrice.toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Giá mua</p>
                      <p className="font-semibold text-lg">
                        {fetchedProduct.PurchasePrice.toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SL thực tế</p>
                      <p className="font-semibold text-lg">
                        {fetchedProduct.QtyAvailable}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Số biến thể</p>
                      <p className="font-semibold text-lg">
                        {fetchedProduct.ProductVariants?.length || 0}
                      </p>
                    </div>
                  </div>
                  
                  {fetchedProduct.ImageUrl && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Hình ảnh</p>
                      <img 
                        src={fetchedProduct.ImageUrl} 
                        alt={fetchedProduct.Name}
                        className="max-h-48 rounded-md border"
                      />
                    </div>
                  )}
                  
                  <Button 
                    onClick={() => setIsEditDialogOpen(true)}
                    className="w-full mt-4"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Chỉnh sửa
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <EditTPOSProductDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={fetchedProduct}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          onOpenChange(false);
          setFetchedProduct(null);
          setProductCode("");
          toast.success("Đã cập nhật sản phẩm thành công");
        }}
      />
      
      <SelectProductDialog
        open={isSelectDialogOpen}
        onOpenChange={setIsSelectDialogOpen}
        onSelect={(product) => {
          setProductCode(product.product_code);
          setIsSelectDialogOpen(false);
        }}
        hidePurchasePrice={true}
      />
    </>
  );
}
