import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { cn } from "@/lib/utils";

interface Order {
  Id: string;
  Code: string;
  Name: string;
  Telephone: string;
  TotalAmount: number;
  TotalQuantity: number;
  DateCreated: string;
}

interface OrderDetail {
  Id: string;
  Code: string;
  Name: string;
  Details: any[];
  Partner: any;
  User: any;
  CRMTeam: any;
}

export const UploadOrderLiveTool = () => {
  const { toast } = useToast();
  
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Date Range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessionIndex, setSessionIndex] = useState("15");
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Step 2: Select Order
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Step 3 & 4: Products and Update
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [productCodes, setProductCodes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);

  const formatDateForAPI = (dateStr: string, isEndDate = false) => {
    // Convert Vietnam date to TPOS datetime format
    // Start of day in Vietnam (00:00 +07:00) = 17:00 same day UTC
    // End of day in Vietnam (23:59:59 +07:00) = 16:59:59 same day UTC
    if (isEndDate) {
      return `${dateStr}T16:59:59+00:00`;
    } else {
      return `${dateStr}T17:00:00+00:00`;
    }
  };

  const handleFetchOrders = async () => {
    if (!startDate || !endDate || !sessionIndex) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
      });
      return;
    }

    setIsFetchingOrders(true);
    setOrders([]);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      const startDateTime = formatDateForAPI(startDate, false);
      const endDateTime = formatDateForAPI(endDate, true);
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=50&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateTime} and DateCreated le ${endDateTime} and SessionIndex eq ${sessionIndex})&$count=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrders(data.value || []);
      
      toast({
        title: "Tìm đơn hàng thành công",
        description: `Tìm thấy ${data['@odata.count'] || data.value?.length || 0} đơn hàng`,
      });
      
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Fetch orders error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tìm đơn hàng",
        description: error.message,
      });
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleContinue = async () => {
    if (!selectedOrder) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn đơn hàng",
      });
      return;
    }

    setIsFetchingDetail(true);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${selectedOrder.Id})?$expand=Details,Partner,User,CRMTeam`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrderDetail(data);
      
      toast({
        title: "Đã tải chi tiết đơn hàng",
        description: `Đơn #${data.Code}`,
      });
      
      setCurrentStep(3);
    } catch (error: any) {
      console.error("Fetch detail error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi lấy chi tiết đơn",
        description: error.message,
      });
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!orderDetail || !productCodes.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập mã sản phẩm",
      });
      return;
    }

    setIsUpdating(true);
    setUpdateResult(null);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      // Parse product codes
      const codes = productCodes.split(',').map(code => code.trim()).filter(code => code);
      
      // Search for each product
      const productPromises = codes.map(async (code) => {
        const searchUrl = `https://tomato.tpos.vn/odata/Product/ODataService.GetView?$filter=DefaultCode eq '${code}'&$top=1`;
        const response = await fetch(searchUrl, {
          headers: getTPOSHeaders(token),
        });
        
        if (!response.ok) {
          throw new Error(`Không tìm thấy sản phẩm ${code}`);
        }
        
        const data = await response.json();
        if (!data.value || data.value.length === 0) {
          throw new Error(`Không tìm thấy sản phẩm ${code} trong TPOS`);
        }
        
        return data.value[0];
      });
      
      const products = await Promise.all(productPromises);
      
      // Create new Details array
      const newDetails = products.map(product => ({
        ProductId: product.Id,
        ProductName: product.Name,
        ProductNameGet: product.NameGet,
        Quantity: 1,
        Price: product.ListPrice || product.PriceVariant || 0,
        UOMId: 1,
        UOMName: "Cái",
        Factor: 1,
        ProductWeight: 0,
      }));
      
      // Update order
      const updateUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderDetail.Id})`;
      const payload = {
        ...orderDetail,
        Details: newDetails,
      };
      
      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: getTPOSHeaders(token),
        body: JSON.stringify(payload),
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Lỗi cập nhật: ${updateResponse.status} - ${errorText}`);
      }
      
      // Handle 204 No Content or JSON response
      let result: any = { success: true };
      if (updateResponse.status !== 204 && updateResponse.headers.get('content-length') !== '0') {
        const contentType = updateResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          result = await updateResponse.json();
        }
      }
      
      setUpdateResult({
        success: true,
        productsAdded: newDetails.length,
        orderCode: orderDetail.Code,
      });
      
      toast({
        title: "✅ Cập nhật thành công",
        description: `Đã cập nhật ${newDetails.length} sản phẩm vào đơn #${orderDetail.Code}`,
      });
      
      setCurrentStep(4);
    } catch (error: any) {
      console.error("Update error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: error.message,
      });
      setUpdateResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const resetTool = () => {
    setCurrentStep(1);
    setOrders([]);
    setSelectedOrder(null);
    setOrderDetail(null);
    setProductCodes("");
    setUpdateResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                1
              </div>
              <div className={cn(
                "w-20 h-1",
                currentStep >= 2 ? "bg-primary" : "bg-muted"
              )} />
            </div>
            <div className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <div className={cn(
                "w-20 h-1",
                currentStep >= 3 ? "bg-primary" : "bg-muted"
              )} />
            </div>
            <div className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                currentStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                3
              </div>
              <div className={cn(
                "w-20 h-1",
                currentStep >= 4 ? "bg-primary" : "bg-muted"
              )} />
            </div>
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold",
              currentStep >= 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              4
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Tìm đơn</span>
            <span>Chọn đơn</span>
            <span>Chọn SP</span>
            <span>Cập nhật</span>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Date Range */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📅 Bước 1: Chọn khoảng thời gian
            </CardTitle>
            <CardDescription>
              🕐 Timezone: Hệ thống sử dụng múi giờ Việt Nam (GMT+7)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Ngày bắt đầu</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Ngày kết thúc</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionIndex">Session Index</Label>
                <Input
                  id="sessionIndex"
                  type="text"
                  value={sessionIndex}
                  onChange={(e) => setSessionIndex(e.target.value)}
                />
              </div>
            </div>
            
            <Button
              onClick={handleFetchOrders}
              disabled={isFetchingOrders}
              className="w-full"
            >
              {isFetchingOrders ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang tìm...
                </>
              ) : (
                "Tìm đơn hàng"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Order */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🛍️ Bước 2: Chọn đơn hàng ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 overflow-y-auto space-y-3">
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Không tìm thấy đơn hàng nào
                </p>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.Id}
                    onClick={() => handleSelectOrder(order)}
                    className={cn(
                      "p-4 border-2 rounded-lg cursor-pointer transition",
                      selectedOrder?.Id === order.Id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">#{order.Code}</p>
                        <p className="text-sm text-muted-foreground">{order.Name}</p>
                        <p className="text-sm text-muted-foreground">{order.Telephone}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {order.TotalAmount?.toLocaleString('vi-VN')}₫
                        </p>
                        <p className="text-sm text-muted-foreground">
                          SL: {order.TotalQuantity}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <Button
              onClick={handleContinue}
              disabled={!selectedOrder || isFetchingDetail}
              className="w-full"
            >
              {isFetchingDetail ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </>
              ) : (
                "Tiếp tục"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3 & 4: Products and Update */}
      {currentStep >= 3 && orderDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📦 Bước 3: Nhập mã sản phẩm
            </CardTitle>
            <CardDescription>
              Đơn hàng: #{orderDetail.Code} - {orderDetail.Name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productCodes">
                Mã sản phẩm (phân cách bằng dấu phẩy)
              </Label>
              <Textarea
                id="productCodes"
                value={productCodes}
                onChange={(e) => setProductCodes(e.target.value)}
                placeholder="N236L, N201D, ..."
                rows={3}
                disabled={currentStep === 4}
              />
            </div>
            
            {currentStep === 3 && (
              <Button
                onClick={handleUpdateOrder}
                disabled={isUpdating}
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Cập nhật đơn hàng
                  </>
                )}
              </Button>
            )}

            {currentStep === 4 && updateResult && (
              <>
                <Alert variant={updateResult.success ? "default" : "destructive"}>
                  {updateResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {updateResult.success ? (
                      <div className="space-y-1">
                        <p className="font-medium">✅ Cập nhật thành công!</p>
                        <p className="text-sm">
                          Đã thêm {updateResult.productsAdded} sản phẩm vào đơn #{updateResult.orderCode}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">❌ Lỗi cập nhật</p>
                        <p className="text-sm">{updateResult.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
                
                <Button onClick={resetTool} variant="outline" className="w-full">
                  Tạo đơn mới
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
