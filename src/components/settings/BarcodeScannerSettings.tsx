import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Barcode, Package, TestTube2, MessageSquare } from "lucide-react";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";

export function BarcodeScannerSettings() {
  const { enabledPages, togglePage } = useBarcodeScanner();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          Cài Đặt Quét Barcode
        </CardTitle>
        <CardDescription>
          Chọn các trang sẽ kích hoạt tính năng quét barcode tự động (có thể chọn nhiều)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <Checkbox 
              id="live-products" 
              checked={enabledPages.includes('live-products')}
              onCheckedChange={() => togglePage('live-products')}
              className="mt-1"
            />
            <div className="flex-1">
              <Label htmlFor="live-products" className="flex items-center gap-2 cursor-pointer">
                <Package className="h-4 w-4" />
                <span className="font-medium">Sản Phẩm Live</span>
                {enabledPages.includes('live-products') && (
                  <Badge variant="default" className="ml-auto">Đang bật</Badge>
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Quét barcode để thêm sản phẩm vào phiên live đang chọn
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <Checkbox 
              id="facebook-comments" 
              checked={enabledPages.includes('facebook-comments')}
              onCheckedChange={() => togglePage('facebook-comments')}
              className="mt-1"
            />
            <div className="flex-1">
              <Label htmlFor="facebook-comments" className="flex items-center gap-2 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">Facebook Comments</span>
                {enabledPages.includes('facebook-comments') && (
                  <Badge variant="default" className="ml-auto">Đang bật</Badge>
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Quét barcode để theo dõi sản phẩm trong livestream comments
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <Checkbox 
              id="settings-test" 
              checked={enabledPages.includes('settings-test')}
              onCheckedChange={() => togglePage('settings-test')}
              className="mt-1"
            />
            <div className="flex-1">
              <Label htmlFor="settings-test" className="flex items-center gap-2 cursor-pointer">
                <TestTube2 className="h-4 w-4" />
                <span className="font-medium">Settings - Test Barcode</span>
                {enabledPages.includes('settings-test') && (
                  <Badge variant="default" className="ml-auto">Đang bật</Badge>
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Chỉ để test chức năng quét barcode trong Settings
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>💡 Lưu ý:</strong> Có thể chọn nhiều trang cùng lúc. Khi quét barcode ở trang không được kích hoạt, hệ thống sẽ hỏi bạn có muốn chuyển trang không.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
