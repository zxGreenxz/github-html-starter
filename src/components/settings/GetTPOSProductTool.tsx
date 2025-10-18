import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Copy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { getProductDetail } from "@/lib/tpos-api";

export const GetTPOSProductTool = () => {
  const [productId, setProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const { toast } = useToast();

  const handleGetProduct = async () => {
    if (!productId.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập TPOS Product ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setProductData(null);

    try {
      const result = await getProductDetail(parseInt(productId));
      
      if (result) {
        setProductData(result);
        setIsJsonOpen(true);
        toast({
          title: "Thành công",
          description: `Đã lấy thông tin sản phẩm ${result.Name || result.Code}`,
        });
      } else {
        throw new Error("Không tìm thấy sản phẩm");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(errorMessage);
      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleGetProduct();
    }
  };

  const copyToClipboard = () => {
    if (productData) {
      navigator.clipboard.writeText(JSON.stringify(productData, null, 2));
      toast({
        title: "Đã sao chép",
        description: "JSON đã được sao chép vào clipboard",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          TPOS Product Lookup
        </CardTitle>
        <CardDescription>
          Nhập TPOS Product ID để xem thông tin chi tiết và JSON response
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Nhập TPOS Product ID (VD: 107831)"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button onClick={handleGetProduct} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang lấy...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Get Product
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {productData && (
          <div className="space-y-4">
            {/* Basic Info */}
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-base">Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">ID:</div>
                  <div>{productData.Id}</div>
                  
                  <div className="font-medium">Tên:</div>
                  <div>{productData.Name}</div>
                  
                  <div className="font-medium">Mã:</div>
                  <div>{productData.Code}</div>
                  
                  {productData.BasePrice !== undefined && (
                    <>
                      <div className="font-medium">Giá bán:</div>
                      <div>{productData.BasePrice?.toLocaleString('vi-VN')} ₫</div>
                    </>
                  )}
                  
                  {productData.OnHand !== undefined && (
                    <>
                      <div className="font-medium">Tồn kho:</div>
                      <div>{productData.OnHand}</div>
                    </>
                  )}
                  
                  {productData.CategoryName && (
                    <>
                      <div className="font-medium">Danh mục:</div>
                      <div>{productData.CategoryName}</div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* JSON Response */}
            <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
              <Card className="border-dashed">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                      {isJsonOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Full Response:</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyToClipboard}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
                      <pre className="text-xs">
                        {JSON.stringify(productData, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
