import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ActivityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    username: string;
    action: string;
    table_name: string;
    created_at: string;
    changes: any;
  } | null;
}

export function ActivityDetailDialog({
  open,
  onOpenChange,
  activity,
}: ActivityDetailDialogProps) {
  if (!activity) return null;

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

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const oldData = activity.changes?.old;
  const newData = activity.changes?.new;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Chi tiết thay đổi
            {getActionBadge(activity.action)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Người dùng:</span> {activity.username}
            </div>
            <div>
              <span className="font-medium">Trang:</span> {getTableLabel(activity.table_name)}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Thời gian:</span>{" "}
              {new Date(activity.created_at).toLocaleString("vi-VN")}
            </div>
          </div>

          {activity.action === "update" && oldData && newData && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Giá trị cũ</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <pre className="text-xs whitespace-pre-wrap">
                    {renderValue(oldData)}
                  </pre>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-green-600">Giá trị mới</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <pre className="text-xs whitespace-pre-wrap">
                    {renderValue(newData)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activity.action === "insert" && newData && (
            <div>
              <h3 className="font-semibold mb-2 text-green-600">Dữ liệu mới</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <pre className="text-xs whitespace-pre-wrap">
                  {renderValue(newData)}
                </pre>
              </div>
            </div>
          )}

          {activity.action === "delete" && oldData && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Dữ liệu đã xóa</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <pre className="text-xs whitespace-pre-wrap">
                  {renderValue(oldData)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
