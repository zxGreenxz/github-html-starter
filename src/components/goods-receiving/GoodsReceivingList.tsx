import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Package, CheckCircle, AlertCircle, AlertTriangle, Trash2 } from "lucide-react";
import { CreateReceivingDialog } from "./CreateReceivingDialog";
import { ViewReceivingDialog } from "./ViewReceivingDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StatusFilter = "needInspection" | "inspected" | "shortage" | "all";

interface GoodsReceivingListProps {
  filteredOrders: any[];
  isLoading: boolean;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  quickFilter: string;
  applyQuickFilter: (filter: string) => void;
  refetch: () => void;
}

export function GoodsReceivingList({ 
  filteredOrders, 
  isLoading, 
  statusFilter, 
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  quickFilter,
  applyQuickFilter,
  refetch
}: GoodsReceivingListProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  return (
    <>
      {!isMobile ? (
        // Desktop View
        <Card>
          <CardHeader>
            <CardTitle>Danh sách đơn hàng</CardTitle>
            
            {/* Desktop Filters */}
            <div className="space-y-4 pt-4">
              {/* Row 1: Date filters and quick filter */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                    placeholder="Từ ngày"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                    placeholder="Đến ngày"
                  />
                </div>
                
                <Select value={quickFilter} onValueChange={applyQuickFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Lọc nhanh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="today">Hôm nay</SelectItem>
                    <SelectItem value="yesterday">Hôm qua</SelectItem>
                    <SelectItem value="3days">3 ngày</SelectItem>
                    <SelectItem value="week">7 ngày</SelectItem>
                    <SelectItem value="month">30 ngày</SelectItem>
                    <SelectItem value="lastMonth">Tháng trước</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: Search and status filter */}
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm nhà cung cấp, sản phẩm, ngày..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needInspection">Cần kiểm</SelectItem>
                    <SelectItem value="inspected">Đã kiểm</SelectItem>
                    <SelectItem value="shortage">Thiếu hàng</SelectItem>
                    <SelectItem value="all">Toàn bộ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : filteredOrders && filteredOrders.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày đặt</TableHead>
                      <TableHead>Nhà cung cấp</TableHead>
                      <TableHead>Tổng SP</TableHead>
                      <TableHead>Tổng SL</TableHead>
                      <TableHead>Ngày kiểm</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order: any) => {
                      const totalItems = order.items?.length || 0;
                      const totalQuantity = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                      
                      return (
                        <TableRow key={order.id} className={order.hasDeletedProduct ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : ""}>
                          <TableCell>
                            {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                          </TableCell>
                          <TableCell className="font-medium">{order.supplier_name}</TableCell>
                          <TableCell>{totalItems}</TableCell>
                          <TableCell>{totalQuantity}</TableCell>
                          <TableCell>
                            {order.receiving?.receiving_date 
                              ? format(new Date(order.receiving.receiving_date), "dd/MM/yyyy HH:mm", { locale: vi })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {order.hasDeletedProduct ? (
                              <Badge variant="destructive">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Đã xóa SP
                              </Badge>
                            ) : order.hasReceiving ? (
                              order.overallStatus === 'shortage' ? (
                                <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Thiếu hàng
                                </Badge>
                              ) : order.overallStatus === 'overage' ? (
                                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Dư hàng
                                </Badge>
                              ) : order.overallStatus === 'mixed' ? (
                                <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Có chênh lệch
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Đủ hàng
                                </Badge>
                              )
                            ) : (order.status === 'confirmed' || order.status === 'pending') ? (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                <Package className="w-3 h-3 mr-1" />
                                Cần kiểm
                              </Badge>
                            ) : (
                              <Badge variant="outline">{order.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!order.hasReceiving && (order.status === 'confirmed' || order.status === 'pending') && !order.hasDeletedProduct && (
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setDialogOpen(true);
                                }}
                              >
                                Kiểm hàng
                              </Button>
                            )}
                            {(order.hasReceiving || order.hasDeletedProduct) && ( // Show "Xem chi tiết" for deleted products too
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setViewOrderId(order.id);
                                  setViewDialogOpen(true);
                                }}
                              >
                                Xem chi tiết
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Không tìm thấy đơn hàng nào
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        // Mobile View - Full Screen
        <div className="space-y-3">
          {/* Mobile: Search + Quick Filter + Status Filter */}
          <div className="flex gap-2 px-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
            
            {/* Quick Filter */}
            <Select value={quickFilter} onValueChange={applyQuickFilter}>
              <SelectTrigger className="w-20 shrink-0 text-xs">
                <SelectValue placeholder="Lọc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="yesterday">Hôm qua</SelectItem>
                <SelectItem value="3days">3 ngày</SelectItem>
                <SelectItem value="week">7 ngày</SelectItem>
                <SelectItem value="month">30 ngày</SelectItem>
                <SelectItem value="lastMonth">Tháng trước</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-20 shrink-0 text-xs">
                <SelectValue placeholder="TT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needInspection">Cần kiểm</SelectItem>
                <SelectItem value="inspected">Đã kiểm</SelectItem>
                <SelectItem value="shortage">Thiếu hàng</SelectItem>
                <SelectItem value="all">Toàn bộ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile: List - Full Width */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div>
              {filteredOrders.map((order: any) => {
                const totalItems = order.items?.length || 0;
                const totalQuantity = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                
                // Prepare status text
                let statusText = '';
                
                if (order.hasDeletedProduct) {
                  statusText = 'Đã xóa SP';
                } else if (order.hasReceiving) {
                  if (order.overallStatus === 'shortage') {
                    statusText = 'Thiếu hàng';
                  } else if (order.overallStatus === 'overage') {
                    statusText = 'Dư hàng';
                  } else if (order.overallStatus === 'mixed') {
                    statusText = 'Chênh lệch';
                  } else {
                    statusText = 'Đủ hàng';
                  }
                } else if (order.status === 'confirmed' || order.status === 'pending') {
                  statusText = 'Cần kiểm';
                } else {
                  statusText = order.status;
                }
                
                return (
                  <div key={order.id} className={cn("bg-card border-b px-4 py-3", order.hasDeletedProduct && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>
                    <div className="flex items-center justify-between gap-3">
                      {/* Group all order info on the left */}
                      <div className="flex items-center gap-2">
                        {/* 1. Date - dd/MM only */}
                        <div className="w-11 shrink-0 text-xs">
                          <div className="font-medium">{format(new Date(order.created_at), "dd/MM")}</div>
                          {order.receiving?.receiving_date && (
                            <div className="text-[10px] text-muted-foreground">
                              ✓ {format(new Date(order.receiving.receiving_date), "dd/MM")}
                            </div>
                          )}
                        </div>
                        
                        {/* 2. Supplier */}
                        <div className="w-12 shrink-0 text-center font-semibold text-sm">
                          {order.supplier_name}
                        </div>
                        
                        {/* 3. Total Items - with Package icon */}
                        <div className="shrink-0 flex items-center gap-1 text-sm">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{totalItems} SP</span>
                        </div>
                        
                        {/* 4. Total Quantity - with bullet */}
                        <div className="shrink-0 flex items-center gap-1 text-sm">
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium">{totalQuantity} cái</span>
                        </div>
                      </div>
                      
                      {/* 5. Action Button - fixed width for uniform appearance */}
                      {!order.hasReceiving && (order.status === 'confirmed' || order.status === 'pending') && !order.hasDeletedProduct && (
                        <Button 
                          className="w-24 h-9 text-xs px-2"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDialogOpen(true);
                          }}
                        >
                          Kiểm hàng
                        </Button>
                      )}
                      {(order.hasReceiving || order.hasDeletedProduct) && ( // Show "Xem chi tiết" for deleted products too
                        <Button 
                          className={`w-24 h-9 text-xs px-2 ${
                            order.hasDeletedProduct ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30' :
                            order.overallStatus === 'shortage' ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-300' :
                            order.overallStatus === 'overage' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300' :
                            order.overallStatus === 'mixed' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-300' :
                            'bg-green-100 text-green-700 hover:bg-green-200 border-green-300'
                          }`}
                          variant="outline"
                          onClick={() => {
                            setViewOrderId(order.id);
                            setViewDialogOpen(true);
                          }}
                        >
                          {statusText}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground px-4">
              Không tìm thấy đơn hàng nào
            </div>
          )}
        </div>
      )}

      <CreateReceivingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
        }}
      />

      <ViewReceivingDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        orderId={viewOrderId || ""}
      />
    </>
  );
}