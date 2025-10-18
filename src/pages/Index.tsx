import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  TrendingUp,
  Plus,
  Eye,
  ArrowRight,
  Store,
  Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const quickStats = [
    { 
      title: "Đơn hàng hôm nay", 
      value: "24", 
      change: "+12%", 
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      title: "Doanh thu hôm nay", 
      value: "₫8,450,000", 
      change: "+8.5%", 
      icon: TrendingUp,
      color: "text-success", 
      bgColor: "bg-success/10"
    },
    { 
      title: "Sản phẩm bán ra", 
      value: "67", 
      change: "+15%", 
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    { 
      title: "Khách hàng mới", 
      value: "5", 
      change: "+25%", 
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10"
    }
  ];

  const recentOrders = [
    { id: "ORD024", customer: "Nguyễn Thị Lan", amount: "₫1,250,000", status: "Đã giao", time: "2 phút trước" },
    { id: "ORD023", customer: "Trần Văn Nam", amount: "₫890,000", status: "Đang giao", time: "15 phút trước" },
    { id: "ORD022", customer: "Lê Thị Hoa", amount: "₫450,000", status: "Chờ xử lý", time: "30 phút trước" },
    { id: "ORD021", customer: "Phạm Minh Tuấn", amount: "₫2,100,000", status: "Đã giao", time: "45 phút trước" }
  ];

  const quickActions = [
    { 
      title: "Thêm đơn hàng mới", 
      description: "Tạo đơn hàng cho khách hàng",
      icon: Plus,
      action: () => navigate("/orders"),
      variant: "default" as const
    },
    { 
      title: "Quản lý sản phẩm", 
      description: "Xem và cập nhật kho hàng",
      icon: Package,
      action: () => navigate("/products"),
      variant: "outline" as const
    },
    { 
      title: "Xem báo cáo", 
      description: "Thống kê và phân tích dữ liệu",
      icon: BarChart3,
      action: () => navigate("/reports"),
      variant: "outline" as const
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Đã giao":
        return <Badge className="bg-success/10 text-success">Đã giao</Badge>;
      case "Đang giao":
        return <Badge className="bg-warning/10 text-warning">Đang giao</Badge>;
      case "Chờ xử lý":
        return <Badge className="bg-muted text-muted-foreground">Chờ xử lý</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className={cn(
        "text-center space-y-4",
        isMobile ? "py-4" : "py-8"
      )}>
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-white",
          isMobile ? "mb-2 text-sm" : "mb-4"
        )}>
          <Store className={isMobile ? "w-4 h-4" : "w-5 h-5"} />
          <span className="font-medium">Hệ Thống Bán Hàng Nội Bộ</span>
        </div>
        <h1 className={cn(
          "font-bold bg-gradient-text bg-clip-text text-transparent",
          isMobile ? "text-2xl" : "text-4xl"
        )}>
          Chào mừng trở lại!
        </h1>
        <p className={cn(
          "text-muted-foreground max-w-2xl mx-auto",
          isMobile ? "text-sm px-4" : "text-xl"
        )}>
          Quản lý đơn hàng, theo dõi doanh số và phân tích hiệu suất kinh doanh một cách hiệu quả
        </p>
      </div>

      {/* Quick Stats */}
      <div className={cn(
        "grid gap-6",
        isMobile ? "grid-cols-2 gap-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className={cn(
              "shadow-soft hover:shadow-glow transition-all duration-300 cursor-pointer",
              !isMobile && "hover:scale-105"
            )}>
              <CardContent className={isMobile ? "p-3" : "p-6"}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn(
                      "text-muted-foreground font-medium",
                      isMobile ? "text-xs" : "text-sm"
                    )}>{stat.title}</p>
                    <p className={cn(
                      "font-bold mt-2",
                      isMobile ? "text-lg" : "text-2xl"
                    )}>{stat.value}</p>
                    <p className={cn(
                      "text-success font-medium mt-1",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {stat.change} từ hôm qua
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-lg",
                    stat.bgColor,
                    isMobile ? "p-2" : "p-3"
                  )}>
                    <Icon className={cn(
                      stat.color,
                      isMobile ? "w-4 h-4" : "w-6 h-6"
                    )} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className={isMobile ? "w-4 h-4" : "w-5 h-5"} />
            <span className={isMobile ? "text-base" : "text-lg"}>Thao tác nhanh</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
          )}>
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={index} 
                  className={cn(
                    "cursor-pointer transition-all duration-200 border-muted",
                    !isMobile && "hover:shadow-soft hover:scale-105"
                  )}
                >
                  <CardContent className={cn(
                    "text-center space-y-4",
                    isMobile ? "p-4" : "p-6"
                  )}>
                    <div className={cn(
                      "mx-auto rounded-lg bg-primary/10 flex items-center justify-center",
                      isMobile ? "w-10 h-10" : "w-12 h-12"
                    )}>
                      <Icon className={cn(
                        "text-primary",
                        isMobile ? "w-5 h-5" : "w-6 h-6"
                      )} />
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-semibold mb-1",
                        isMobile ? "text-sm" : "text-base"
                      )}>{action.title}</h3>
                      <p className={cn(
                        "text-muted-foreground mb-4",
                        isMobile ? "text-xs" : "text-sm"
                      )}>{action.description}</p>
                      <Button 
                        variant={action.variant} 
                        onClick={action.action}
                        size={isMobile ? "sm" : "default"}
                        className="w-full"
                      >
                        Truy cập ngay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <div className={cn(
        "grid gap-6",
        isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"
      )}>
        <Card className={cn(
          "shadow-soft",
          !isMobile && "lg:col-span-2"
        )}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className={cn(
              "flex items-center gap-2",
              isMobile ? "text-base" : "text-lg"
            )}>
              <Clock className={isMobile ? "w-4 h-4" : "w-5 h-5"} />
              Đơn hàng gần đây
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/orders")}>
              <Eye className="w-4 h-4 mr-2" />
              {!isMobile && "Xem tất cả"}
            </Button>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              // Mobile: Card view
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <Card key={order.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <p className="font-medium text-sm">{order.id}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{order.customer}</p>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-primary">{order.amount}</p>
                      <p className="text-xs text-muted-foreground">{order.time}</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              // Desktop: Original layout
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-4 rounded-lg bg-gradient-card hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div>
                        <p className="font-medium">{order.id}</p>
                        <p className="text-sm text-muted-foreground">{order.customer}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{order.amount}</p>
                      <p className="text-xs text-muted-foreground">{order.time}</p>
                    </div>
                    <div>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className={isMobile ? "text-base" : "text-lg"}>
              Truy cập nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="w-full justify-start" 
              onClick={() => navigate("/dashboard")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard tổng quan
            </Button>
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="w-full justify-start" 
              onClick={() => navigate("/customers")}
            >
              <Users className="w-4 h-4 mr-2" />
              Quản lý khách hàng
            </Button>
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="w-full justify-start" 
              onClick={() => navigate("/reports")}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Báo cáo nhà cung cấp
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
