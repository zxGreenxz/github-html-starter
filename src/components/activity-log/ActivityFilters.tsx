import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { vi } from "date-fns/locale";

interface ActivityFiltersProps {
  onFilterChange: (filters: {
    userId?: string;
    tableName?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => void;
}

export function ActivityFilters({ onFilterChange }: ActivityFiltersProps) {
  const [userId, setUserId] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  const { data: users } = useQuery({
    queryKey: ["activity-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("user_id, username")
        .order("username");
      
      // Get unique users
      const uniqueUsers = Array.from(
        new Map(data?.map(item => [item.user_id, item])).values()
      );
      
      return uniqueUsers;
    },
  });

  const tables = [
    { value: "purchase_orders", label: "Đặt hàng NCC" },
    { value: "purchase_order_items", label: "Chi tiết đơn hàng" },
    { value: "products", label: "Kho Sản Phẩm" },
    { value: "live_orders", label: "Order Live" },
    { value: "live_sessions", label: "Phiên Live" },
    { value: "live_products", label: "Sản phẩm Live" },
    { value: "goods_receiving", label: "Kiểm hàng" },
    { value: "goods_receiving_items", label: "Chi tiết kiểm hàng" },
  ];

  const actions = [
    { value: "insert", label: "Tạo mới" },
    { value: "update", label: "Cập nhật" },
    { value: "delete", label: "Xóa" },
  ];

  const handleApply = () => {
    onFilterChange({
      userId: userId || undefined,
      tableName: tableName || undefined,
      action: action || undefined,
      dateFrom,
      dateTo,
    });
  };

  const handleClear = () => {
    setUserId("");
    setTableName("");
    setAction("");
    setDateFrom(undefined);
    setDateTo(undefined);
    onFilterChange({});
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Người dùng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {users?.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id || ""}>
                {user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tableName} onValueChange={setTableName}>
          <SelectTrigger>
            <SelectValue placeholder="Trang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {tables.map((table) => (
              <SelectItem key={table.value} value={table.value}>
                {table.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue placeholder="Hành động" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {actions.map((act) => (
              <SelectItem key={act.value} value={act.value}>
                {act.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: vi }) : "Từ ngày"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: vi }) : "Đến ngày"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Áp dụng
        </Button>
        <Button onClick={handleClear} variant="outline" size="sm">
          <X className="mr-2 h-4 w-4" />
          Xóa bộ lọc
        </Button>
      </div>
    </div>
  );
}
