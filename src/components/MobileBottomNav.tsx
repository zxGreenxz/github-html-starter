import { NavLink, useLocation } from "react-router-dom";
import { 
  ShoppingCart, 
  BarChart3, 
  Package, 
  Warehouse,
  MessageSquare,
  MoreHorizontal,
  ShoppingBag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const mainNavItems = [
  {
    title: "Live",
    url: "/live-products",
    icon: ShoppingCart,
  },
  {
    title: "Báo Cáo",
    url: "/livestream-reports",
    icon: BarChart3,
  },
  {
    title: "Sản Phẩm",
    url: "/products",
    icon: Warehouse,
  },
  {
    title: "Kiểm Hàng",
    url: "/goods-receiving",
    icon: Package,
  },
  {
    title: "Comment",
    url: "/facebook-comments",
    icon: MessageSquare,
  },
];

const moreNavItems = [
  {
    title: "Đặt hàng NCC",
    url: "/purchase-orders",
    icon: ShoppingBag,
  },
  {
    title: "Kho Khách Hàng",
    url: "/customers",
    icon: MessageSquare,
  },
  {
    title: "Tìm Kiếm SP",
    url: "/search-products",
    icon: Package,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Package,
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 pb-safe">
      <div className="grid grid-cols-6 h-16">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.url);
          
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                active && "bg-primary/10"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">{item.title}</span>
            </NavLink>
          );
        })}

        {/* More Menu */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <div className="p-2 rounded-lg">
                <MoreHorizontal className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Thêm</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[50vh]">
            <SheetHeader>
              <SheetTitle>Menu khác</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 mt-4">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      active 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
