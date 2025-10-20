import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [viewMode, setViewMode] = useState<"normal" | "json">("normal");
  
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

  const getFieldLabel = (fieldName: string): string => {
    const labelMap: Record<string, string> = {
      // Common fields
      id: "ID",
      created_at: "Thời gian tạo",
      updated_at: "Thời gian cập nhật",
      user_id: "ID người dùng",
      username: "Tên đăng nhập",
      
      // Products
      product_name: "Tên sản phẩm",
      product_code: "Mã sản phẩm",
      base_product_code: "Mã sản phẩm gốc",
      variant: "Biến thể",
      product_images: "Hình ảnh sản phẩm",
      price_images: "Hình ảnh giá",
      selling_price: "Giá bán",
      purchase_price: "Giá nhập",
      stock_quantity: "Số lượng tồn kho",
      supplier_name: "Tên NCC",
      category: "Danh mục",
      unit: "Đơn vị",
      barcode: "Mã vạch",
      tpos_product_id: "ID sản phẩm TPOS",
      tpos_image_url: "Link ảnh TPOS",
      productid_bienthe: "ID biến thể",
      
      // Purchase Orders
      purchase_order_id: "ID đơn đặt hàng",
      order_date: "Ngày đặt hàng",
      invoice_number: "Số hóa đơn",
      invoice_date: "Ngày hóa đơn",
      invoice_images: "Hình hóa đơn",
      total_amount: "Tổng tiền",
      discount_amount: "Tiền giảm giá",
      final_amount: "Thành tiền",
      shipping_fee: "Phí vận chuyển",
      status: "Trạng thái",
      notes: "Ghi chú",
      quantity: "Số lượng",
      position: "Vị trí",
      
      // Live Sessions
      live_session_id: "ID phiên live",
      session_name: "Tên phiên",
      session_date: "Ngày phiên",
      session_index: "STT",
      start_date: "Ngày bắt đầu",
      end_date: "Ngày kết thúc",
      
      // Live Products
      live_product_id: "ID sản phẩm live",
      product_type: "Loại sản phẩm",
      prepared_quantity: "SL chuẩn bị",
      sold_quantity: "SL đã bán",
      image_url: "Link ảnh",
      note: "Ghi chú",
      
      // Live Orders
      order_count: "Số đơn",
      is_oversell: "Oversell",
      upload_status: "Trạng thái upload",
      uploaded_at: "Thời gian upload",
      tpos_order_id: "ID đơn TPOS",
      code_tpos_order_id: "Mã đơn TPOS",
      
      // Goods Receiving
      goods_receiving_id: "ID phiếu kiểm",
      purchase_order_item_id: "ID chi tiết đơn hàng",
      receiving_date: "Ngày kiểm",
      received_by_user_id: "ID người kiểm",
      received_by_username: "Người kiểm",
      expected_quantity: "SL dự kiến",
      received_quantity: "SL nhận được",
      discrepancy_quantity: "SL chênh lệch",
      discrepancy_type: "Loại chênh lệch",
      product_condition: "Tình trạng SP",
      item_notes: "Ghi chú mặt hàng",
      total_items_expected: "Tổng SL dự kiến",
      total_items_received: "Tổng SL nhận",
      has_discrepancy: "Có chênh lệch",
      
      // Facebook
      facebook_comment_id: "ID bình luận FB",
      facebook_user_id: "ID người dùng FB",
      facebook_user_name: "Tên người dùng FB",
      facebook_post_id: "ID bài đăng FB",
      comment_message: "Nội dung bình luận",
      comment_created_time: "Thời gian bình luận",
      like_count: "Số lượt thích",
      tpos_sync_status: "Trạng thái đồng bộ TPOS",
      tpos_session_index: "STT phiên TPOS",
      comment_type: "Loại comment",
      is_deleted: "Đã xóa",
      is_deleted_by_tpos: "Đã xóa bởi TPOS",
      last_synced_at: "Lần đồng bộ cuối",
      last_fetched_at: "Lần lấy cuối",
      
      // Customers
      customer_name: "Tên khách hàng",
      phone: "Số điện thoại",
      email: "Email",
      address: "Địa chỉ",
      idkh: "Mã KH",
      customer_status: "Trạng thái KH",
      info_status: "Trạng thái thông tin",
      total_orders: "Tổng đơn hàng",
      total_spent: "Tổng chi tiêu",
      
      // Live Phases
      live_phase_id: "ID giai đoạn",
      phase_date: "Ngày giai đoạn",
      phase_type: "Loại giai đoạn",
      
      // Livestream Reports
      report_date: "Ngày báo cáo",
      morning_duration: "Thời lượng sáng",
      evening_duration: "Thời lượng tối",
      morning_ad_cost: "Chi phí quảng cáo sáng",
      evening_ad_cost: "Chi phí quảng cáo tối",
      morning_live_orders: "Đơn live sáng",
      evening_live_orders: "Đơn live tối",
      total_inbox_orders: "Tổng đơn inbox",
    };
    
    return labelMap[fieldName] || fieldName;
  };

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderNormalValue = (value: any): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">Không có dữ liệu</span>;
    }
    
    if (typeof value === "object") {
      return (
        <div className="space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium min-w-[200px]">{getFieldLabel(key)}:</span>
              <span className="flex-1">
                {val === null || val === undefined 
                  ? <span className="text-muted-foreground italic">Không có</span>
                  : typeof val === "object"
                  ? JSON.stringify(val)
                  : String(val)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    
    return <span>{String(value)}</span>;
  };

  const oldData = activity.changes?.old;
  const newData = activity.changes?.new;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              Chi tiết thay đổi
              {getActionBadge(activity.action)}
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("normal")}
              >
                Bình thường
              </Button>
              <Button
                variant={viewMode === "json" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("json")}
              >
                JSON
              </Button>
            </div>
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
                  {viewMode === "json" ? (
                    <pre className="text-xs whitespace-pre-wrap">
                      {renderValue(oldData)}
                    </pre>
                  ) : (
                    <div className="text-sm">
                      {renderNormalValue(oldData)}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-green-600">Giá trị mới</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  {viewMode === "json" ? (
                    <pre className="text-xs whitespace-pre-wrap">
                      {renderValue(newData)}
                    </pre>
                  ) : (
                    <div className="text-sm">
                      {renderNormalValue(newData)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activity.action === "insert" && newData && (
            <div>
              <h3 className="font-semibold mb-2 text-green-600">Dữ liệu mới</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                {viewMode === "json" ? (
                  <pre className="text-xs whitespace-pre-wrap">
                    {renderValue(newData)}
                  </pre>
                ) : (
                  <div className="text-sm">
                    {renderNormalValue(newData)}
                  </div>
                )}
              </div>
            </div>
          )}

          {activity.action === "delete" && oldData && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Dữ liệu đã xóa</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                {viewMode === "json" ? (
                  <pre className="text-xs whitespace-pre-wrap">
                    {renderValue(oldData)}
                  </pre>
                ) : (
                  <div className="text-sm">
                    {renderNormalValue(oldData)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
