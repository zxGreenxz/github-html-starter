import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { ActivityDetailDialog } from "./ActivityDetailDialog";

interface ActivityTableProps {
  filters: {
    userId?: string;
    tableName?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

export function ActivityTable({ filters }: ActivityTableProps) {
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities", filters],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters.userId && filters.userId !== "all") {
        query = query.eq("user_id", filters.userId);
      }

      if (filters.tableName && filters.tableName !== "all") {
        query = query.eq("table_name", filters.tableName);
      }

      if (filters.action && filters.action !== "all") {
        query = query.eq("action", filters.action);
      }

      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getActionBadge = (action: string) => {
    const variants = {
      insert: { variant: "default" as const, label: "Tạo mới", color: "bg-green-100 text-green-800" },
      update: { variant: "secondary" as const, label: "Cập nhật", color: "bg-yellow-100 text-yellow-800" },
      delete: { variant: "destructive" as const, label: "Xóa", color: "bg-red-100 text-red-800" },
    };
    const config = variants[action as keyof typeof variants] || variants.insert;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      purchase_orders: "Đặt hàng NCC",
      purchase_order_items: "Chi tiết đơn hàng",
      products: "Kho Sản Phẩm",
      live_orders: "Order Live",
      live_sessions: "Phiên Live",
      live_products: "Sản phẩm Live",
      goods_receiving: "Kiểm hàng",
      goods_receiving_items: "Chi tiết kiểm hàng",
    };
    return labels[tableName] || tableName;
  };

  const handleViewDetail = (activity: any) => {
    setSelectedActivity(activity);
    setDetailOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Không có hoạt động nào
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">STT</TableHead>
              <TableHead className="w-[150px]">Người dùng</TableHead>
              <TableHead className="w-[120px]">Hành động</TableHead>
              <TableHead className="w-[180px]">Trang</TableHead>
              <TableHead className="w-[180px]">Thời gian</TableHead>
              <TableHead className="w-[100px] text-center">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity, index) => (
              <TableRow key={activity.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{activity.username}</TableCell>
                <TableCell>{getActionBadge(activity.action)}</TableCell>
                <TableCell>{getTableLabel(activity.table_name)}</TableCell>
                <TableCell>
                  {new Date(activity.created_at).toLocaleString("vi-VN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetail(activity)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ActivityDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        activity={selectedActivity}
      />
    </>
  );
}
