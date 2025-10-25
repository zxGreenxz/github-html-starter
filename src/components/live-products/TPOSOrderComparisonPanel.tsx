import { useTPOSOrderDetails } from "@/hooks/use-tpos-order-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";

interface TPOSOrderComparisonPanelProps {
  sessionIndex: number;
  startDate: string;
  endDate: string;
  localProducts: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  onClose?: () => void;
}

export function TPOSOrderComparisonPanel({
  sessionIndex,
  startDate,
  endDate,
  localProducts,
  onClose,
}: TPOSOrderComparisonPanelProps) {
  const { orderInfo, isLoading, error, refetch } = useTPOSOrderDetails({
    sessionIndex,
    startDate,
    endDate,
    enabled: true,
  });

  // Create a map of local products for quick lookup
  const localProductsMap = new Map(
    localProducts.map(p => [p.product_code, p])
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu từ TPOS...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] gap-3">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            {error.message}
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Thử lại
          </Button>
        </div>
      );
    }

    if (!orderInfo) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] gap-3">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <p className="text-sm font-medium">Chưa có đơn hàng cho SessionIndex này</p>
          <p className="text-xs text-muted-foreground">
            SessionIndex {sessionIndex} chưa có đơn hàng nào trên TPOS
          </p>
        </div>
      );
    }

    if (!orderInfo.Details || orderInfo.Details.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] gap-3">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <p className="text-sm font-medium">Đơn hàng trống</p>
          <p className="text-xs text-muted-foreground">
            Đơn {orderInfo.Code} không có sản phẩm nào
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Order info header */}
        <div className="bg-muted p-3 rounded-md mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Đơn hàng TPOS</div>
            <Badge variant="outline">{orderInfo.Code}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Tổng SL:</span> {orderInfo.TotalQuantity}
            </div>
            <div>
              <span className="font-medium">Tổng tiền:</span>{' '}
              {formatVND(orderInfo.TotalAmount)}
            </div>
          </div>
        </div>

        {/* Products table */}
        <ScrollArea className="h-[350px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Mã SP</TableHead>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead className="text-center w-[80px]">SL</TableHead>
                <TableHead className="text-right w-[120px]">Giá</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderInfo.Details.map((detail) => {
                const localProduct = localProductsMap.get(detail.ProductCode);
                const isMatched = !!localProduct;
                const hasQuantityMismatch = localProduct && localProduct.quantity !== detail.Quantity;

                return (
                  <TableRow
                    key={detail.Id}
                    className={isMatched ? 'bg-green-50' : 'bg-orange-50'}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {detail.ProductCode}
                        {!isMatched && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Mới
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {detail.ProductName}
                      {detail.Note && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Note: {detail.Note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {detail.Quantity}
                        {hasQuantityMismatch && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                            ≠ {localProduct.quantity}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVND(detail.Price)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>Trùng với dữ liệu local</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded"></div>
            <span>Không có trong local</span>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="border rounded-md p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          Chi tiết đơn TPOS - SessionIndex: {sessionIndex}
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        )}
      </div>
      {renderContent()}
    </div>
  );
}
