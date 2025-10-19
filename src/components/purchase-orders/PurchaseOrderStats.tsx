import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, DollarSign, TrendingUp, Clock, Link2 } from "lucide-react";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";

interface PurchaseOrderItem {
  id?: string;
  quantity: number;
  position?: number;
  notes?: string | null;
  tpos_product_id?: number | null;
  tpos_deleted?: boolean;
  tpos_deleted_at?: string | null;
  // Primary fields (renamed from snapshot)
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_id?: string | null;
  notes: string | null;
  invoice_date: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderStatsProps {
  filteredOrders: PurchaseOrder[];
  allOrders: PurchaseOrder[];
  isLoading: boolean;
  isMobile?: boolean;
}

export function PurchaseOrderStats({ filteredOrders, allOrders, isLoading, isMobile = false }: PurchaseOrderStatsProps) {
  // Calculate stats from filteredOrders for filtered data
  const totalOrders = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0);
  
  // Calculate today's stats from allOrders (unfiltered)
  const todayOrders = allOrders.filter(order => 
    format(new Date(order.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );
  const todayOrdersCount = todayOrders.length;
  const todayTotalAmount = todayOrders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0);

  // Calculate TPOS sync stats from filteredOrders
  const allItems = filteredOrders.flatMap(order => order.items || []);
  const syncedItems = allItems.filter(item => item.tpos_product_id);
  const tposSyncRatio = allItems.length > 0 ? ((syncedItems.length / allItems.length) * 100).toFixed(1) : '0';


  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-2" : "md:grid-cols-2 lg:grid-cols-5"
    )}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn(
            "font-medium",
            isMobile ? "text-xs" : "text-sm"
          )}>Tổng đơn hàng</CardTitle>
          <FileText className={cn(
            "text-muted-foreground",
            isMobile ? "h-3 w-3" : "h-4 w-4"
          )} />
        </CardHeader>
        <CardContent className={isMobile ? "pt-0" : ""}>
          <div className={cn(
            "font-bold",
            isMobile ? "text-lg" : "text-2xl"
          )}>{isLoading ? "..." : totalOrders}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn(
            "font-medium",
            isMobile ? "text-xs" : "text-sm"
          )}>Tổng giá trị</CardTitle>
          <DollarSign className={cn(
            "text-muted-foreground",
            isMobile ? "h-3 w-3" : "h-4 w-4"
          )} />
        </CardHeader>
        <CardContent className={isMobile ? "pt-0" : ""}>
          <div className={cn(
            "font-bold",
            isMobile ? "text-sm" : "text-2xl"
          )}>
            {isLoading ? "..." : formatVND(totalAmount)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn(
            "font-medium",
            isMobile ? "text-xs" : "text-sm"
          )}>Đơn hôm nay</CardTitle>
          <Clock className={cn(
            "text-muted-foreground",
            isMobile ? "h-3 w-3" : "h-4 w-4"
          )} />
        </CardHeader>
        <CardContent className={isMobile ? "pt-0" : ""}>
          <div className={cn(
            "font-bold",
            isMobile ? "text-lg" : "text-2xl"
          )}>{isLoading ? "..." : todayOrdersCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn(
            "font-medium",
            isMobile ? "text-xs" : "text-sm"
          )}>Giá trị hôm nay</CardTitle>
          <TrendingUp className={cn(
            "text-muted-foreground",
            isMobile ? "h-3 w-3" : "h-4 w-4"
          )} />
        </CardHeader>
        <CardContent className={isMobile ? "pt-0" : ""}>
          <div className={cn(
            "font-bold",
            isMobile ? "text-sm" : "text-2xl"
          )}>
            {isLoading ? "..." : formatVND(todayTotalAmount)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn(
            "font-medium",
            isMobile ? "text-xs" : "text-sm"
          )}>Đồng bộ TPOS</CardTitle>
          <Link2 className={cn(
            "text-muted-foreground",
            isMobile ? "h-3 w-3" : "h-4 w-4"
          )} />
        </CardHeader>
        <CardContent className={isMobile ? "pt-0" : ""}>
          <div className={cn(
            "font-bold text-green-600",
            isMobile ? "text-sm" : "text-2xl"
          )}>
            {isLoading ? "..." : `${syncedItems.length}/${allItems.length}`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {tposSyncRatio}% đã upload
          </p>
        </CardContent>
      </Card>
    </div>
  );
}