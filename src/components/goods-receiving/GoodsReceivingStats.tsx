import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, AlertTriangle, Boxes, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface GoodsReceivingStatsProps {
  filteredOrders: any[];
  isLoading: boolean;
}

export function GoodsReceivingStats({ filteredOrders, isLoading }: GoodsReceivingStatsProps) {
  const isMobile = useIsMobile();
  
  // Hide stats on mobile
  if (isMobile) {
    return null;
  }
  
  // Calculate stats from filtered orders
  const stats = {
    totalOrders: filteredOrders.length,
    totalValue: filteredOrders.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0
    ),
    inspectedToday: filteredOrders.filter(order => {
      if (!order.receiving?.receiving_date) return false;
      const today = format(new Date(), 'yyyy-MM-dd');
      const receivingDate = format(new Date(order.receiving.receiving_date), 'yyyy-MM-dd');
      return receivingDate === today;
    }).length,
    withDiscrepancy: filteredOrders.filter(order => 
      order.receiving?.has_discrepancy === true
    ).length,
    totalProducts: filteredOrders.reduce((sum, order) => 
      sum + (order.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0
    )
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(amount);
  };

  const statsCards = [
    {
      title: "Tổng đơn hàng",
      value: stats.totalOrders,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Tổng giá trị",
      value: formatCurrency(stats.totalValue),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      title: "Đã kiểm hôm nay",
      value: stats.inspectedToday,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Có chênh lệch",
      value: stats.withDiscrepancy,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      title: "Tổng sản phẩm",
      value: stats.totalProducts,
      icon: Boxes,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {statsCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
