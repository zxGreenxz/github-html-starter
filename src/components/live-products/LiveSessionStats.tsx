import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, TrendingUp, Users } from "lucide-react";

interface LiveProduct {
  id: string;
  prepared_quantity: number;
  sold_quantity: number;
}

interface LiveOrder {
  id: string;
  live_product_id: string;
  quantity: number;
  session_index: number;
  tpos_order_id?: string | null;
}

interface LiveSessionStatsProps {
  sessionId: string;
  phaseId: string | "all";
  products: LiveProduct[];
  orders: LiveOrder[];
}

export function LiveSessionStats({ sessionId, phaseId, products, orders }: LiveSessionStatsProps) {
  const totalPreparedQuantity = products.reduce((sum, product) => sum + product.prepared_quantity, 0);
  const totalSoldQuantity = products.reduce((sum, product) => sum + product.sold_quantity, 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(orders.map(order => order.session_index)).size;
  
  const sellThroughRate = totalPreparedQuantity > 0 
    ? ((totalSoldQuantity / totalPreparedQuantity) * 100).toFixed(1)
    : "0.0";

  const stats = [
    {
      title: "Tổng SL NCC",
      value: totalPreparedQuantity.toLocaleString(),
      icon: Package,
      description: "Số lượng chuẩn bị",
      color: "bg-blue-500",
    },
    {
      title: "Tổng SL khách",
      value: totalSoldQuantity.toLocaleString(),
      icon: TrendingUp,
      description: "Số lượng đã bán",
      color: "bg-green-500",
      extraInfo: `${sellThroughRate}% sell-through`,
    },
    {
      title: "Số đơn hàng",
      value: totalOrders.toLocaleString(),
      icon: ShoppingCart,
      description: "Đơn hàng unique",
      color: "bg-orange-500",
    },
    {
      title: "Khách hàng",
      value: uniqueCustomers.toLocaleString(),
      icon: Users,
      description: "Khách hàng unique",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`p-2 rounded-md ${stat.color}`}>
              <stat.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
            {stat.extraInfo && (
              <div className="mt-2">
                <Badge variant={parseFloat(sellThroughRate) >= 80 ? "default" : "secondary"}>
                  {stat.extraInfo}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}