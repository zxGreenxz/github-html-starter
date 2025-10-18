import { 
  ShoppingCart, 
  Settings,
  ShoppingBag,
  BarChart3,
  Package,
  Warehouse,
  Search,
  History,
  Users,
  MessageSquare,
  LogOut,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Đặt hàng NCC",
    url: "/purchase-orders",
    icon: ShoppingBag,
  },
  {
    title: "Kiểm hàng",
    url: "/goods-receiving",
    icon: Package,
  },
  {
    title: "Order Live",
    url: "/live-products",
    icon: ShoppingCart,
  },
  {
    title: "Livestream Comment",
    url: "/facebook-comments",
    icon: MessageSquare,
  },
  {
    title: "Báo Cáo Livestream",
    url: "/livestream-reports",
    icon: BarChart3,
  },
];

const adminItems = [
  {
    title: "Kho Sản Phẩm",
    url: "/products",
    icon: Warehouse,
  },
  {
    title: "Kho Khách Hàng",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Tìm Kiếm SP",
    url: "/search-products",
    icon: Search,
  },
  {
    title: "Lịch sử chỉnh sửa",
    url: "/activity-log",
    icon: History,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const { user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClass = "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200";
    if (isActive(path)) {
      return `${baseClass} bg-gradient-primary text-primary-foreground shadow-soft`;
    }
    return `${baseClass} text-muted-foreground hover:text-foreground hover:bg-muted`;
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return "U";
    const username = email.split('@')[0];
    return username.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (email: string | undefined) => {
    if (!email) return "User";
    return email.split('@')[0];
  };

  return (
    <Sidebar className="border-r border-border h-screen fixed left-0 top-0">
      <SidebarContent className="p-4 flex flex-col h-full pt-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 px-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="text-lg font-semibold">Sales Manager</h2>
                <p className="text-xs text-muted-foreground">Hệ thống bán hàng</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "hidden" : ""}>
            Chức năng chính
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"}
                      className={getNavClassName(item.url)}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className={isCollapsed ? "hidden" : ""}>
            Quản trị
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={getNavClassName(item.url)}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Profile Section - at the bottom */}
        <div className="mt-auto pt-4">
          <Separator className="mb-4" />
          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                  {getInitials(user?.email)}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getDisplayName(user?.email)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="w-full mt-3 justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Đăng xuất
              </Button>
            )}
            {isCollapsed && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="w-full mt-3 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}