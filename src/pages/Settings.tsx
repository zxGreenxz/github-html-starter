import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Key, Printer, Book } from "lucide-react";
import { TPOSCredentialsManager } from "@/components/settings/TPOSCredentialsManager";
import { BarcodeScannerSettings } from "@/components/settings/BarcodeScannerSettings";
import { PrinterConfigManager } from "@/components/settings/PrinterConfigManager";
import { TPOSAPIReference } from "@/components/settings/TPOSAPIReference";
import { SystemDocumentation } from "@/components/settings/SystemDocumentation";
import { PredictionStatsMonitor } from "@/components/settings/PredictionStatsMonitor";

const Settings = () => {
  const [usePrediction, setUsePrediction] = useState(() => {
    return localStorage.getItem('use_session_index_prediction') === 'true';
  });
  const isMobile = useIsMobile();
  const { toast } = useToast();

  return (
    <div className={cn("mx-auto space-y-6", isMobile ? "p-4" : "container p-6")}>
      <div className={cn("flex items-center", isMobile ? "flex-col items-start gap-3 w-full" : "justify-between")}>
        <div>
          <h1 className={cn("font-bold", isMobile ? "text-xl" : "text-3xl")}>Cài đặt</h1>
          <p className={cn("text-muted-foreground mt-2", isMobile ? "text-sm" : "text-base")}>
            Quản lý các cài đặt hệ thống
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-5 gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Key className="h-4 w-4" />
            <span className={isMobile ? "hidden" : "inline"}>Cấu hình chung</span>
            <span className={isMobile ? "inline" : "hidden"}>Chung</span>
          </TabsTrigger>
          <TabsTrigger value="barcode" className="gap-2">
            Barcode
          </TabsTrigger>
          <TabsTrigger value="printer" className="gap-2">
            <Printer className="h-4 w-4" />
            <span className={isMobile ? "hidden" : "inline"}>Máy in</span>
            <span className={isMobile ? "inline" : "hidden"}>In</span>
          </TabsTrigger>
          <TabsTrigger value="api-reference" className="gap-2">
            API
          </TabsTrigger>
          <TabsTrigger value="documentation" className="gap-2">
            <span className={isMobile ? "hidden" : "inline"}>Tài liệu</span>
            <span className={isMobile ? "inline" : "hidden"}>Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-4">
          <TPOSCredentialsManager />
          
          <Card>
            <CardHeader>
              <CardTitle>Tối ưu tạo đơn hàng</CardTitle>
              <CardDescription>
                Cấu hình dự đoán mã đơn hàng để hiển thị nhanh hơn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50">
                <Switch
                  id="prediction-toggle"
                  checked={usePrediction}
                  onCheckedChange={(checked) => {
                    localStorage.setItem('use_session_index_prediction', String(checked));
                    setUsePrediction(checked);
                    toast({
                      title: checked ? "✅ Đã bật dự đoán mã đơn" : "❌ Đã tắt dự đoán mã đơn",
                      description: checked 
                        ? "Mã đơn sẽ hiển thị ngay lập tức. Có thể thay đổi nếu có nhiều đơn cùng lúc."
                        : "Mã đơn sẽ được lấy từ TPOS (chậm hơn nhưng chính xác 100%)",
                    });
                  }}
                />
                <div className="flex-1">
                  <label htmlFor="prediction-toggle" className="text-sm font-medium cursor-pointer">
                    Dự đoán mã đơn hàng trước (hiển thị ngay)
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hiển thị số đơn ngay lập tức thay vì đợi TPOS (~500ms nhanh hơn)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {usePrediction && (
            <Card>
              <CardHeader>
                <CardTitle>Thống kê dự đoán mã đơn</CardTitle>
                <CardDescription>
                  Theo dõi độ chính xác của dự đoán session_index (7 ngày gần đây)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PredictionStatsMonitor />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="barcode" className="space-y-6 mt-4">
          <BarcodeScannerSettings />
        </TabsContent>

        <TabsContent value="printer" className="space-y-6 mt-4">
          <PrinterConfigManager />
        </TabsContent>

        <TabsContent value="api-reference" className="space-y-6 mt-4">
          <TPOSAPIReference />
        </TabsContent>

        <TabsContent value="documentation" className="space-y-6 mt-4">
          <SystemDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
