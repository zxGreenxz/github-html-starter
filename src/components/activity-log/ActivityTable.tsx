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
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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

  const toggleRowExpansion = (activityId: string) => {
    setExpandedRowId(expandedRowId === activityId ? null : activityId);
  };

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
    };
    
    return labelMap[fieldName] || fieldName;
  };

  const generateSummary = (activity: any): string => {
    const { action, table_name, changes } = activity;
    const newData = changes?.new;
    const oldData = changes?.old;
    
    let summary = "";
    
    switch (action) {
      case "insert":
        if (table_name === "purchase_orders") {
          summary = `Tạo đơn đặt hàng NCC: ${newData?.supplier_name || ""}, tổng tiền: ${newData?.final_amount?.toLocaleString('vi-VN') || 0}`;
        } else if (table_name === "products") {
          summary = `Tạo sản phẩm: ${newData?.product_code || ""} ${newData?.product_name || ""}, giá bán: ${newData?.selling_price?.toLocaleString('vi-VN') || 0}`;
        } else if (table_name === "live_orders") {
          summary = `Tạo order live: ${newData?.customer_name || ""}, mã KH: ${newData?.idkh || ""}, SL: ${newData?.quantity || 0}`;
        } else if (table_name === "goods_receiving") {
          summary = `Tạo phiếu kiểm hàng, tổng SL dự kiến: ${newData?.total_items_expected || 0}, SL nhận: ${newData?.total_items_received || 0}`;
        } else {
          summary = `Tạo mới dữ liệu trong ${getTableLabel(table_name)}`;
        }
        break;
        
      case "update":
        if (table_name === "products") {
          const changes: string[] = [];
          if (oldData?.product_name !== newData?.product_name) {
            changes.push(`Tên: "${oldData?.product_name}" → "${newData?.product_name}"`);
          }
          if (oldData?.selling_price !== newData?.selling_price) {
            changes.push(`Giá bán: ${oldData?.selling_price?.toLocaleString('vi-VN')} → ${newData?.selling_price?.toLocaleString('vi-VN')}`);
          }
          if (oldData?.stock_quantity !== newData?.stock_quantity) {
            changes.push(`Tồn kho: ${oldData?.stock_quantity} → ${newData?.stock_quantity}`);
          }
          summary = `Cập nhật sản phẩm ${newData?.product_code}: ${changes.join(", ") || "các trường khác"}`;
        } else if (table_name === "purchase_orders") {
          summary = `Cập nhật đơn đặt hàng NCC: ${newData?.supplier_name || oldData?.supplier_name || ""}`;
        } else {
          summary = `Cập nhật dữ liệu trong ${getTableLabel(table_name)}`;
        }
        break;
        
      case "delete":
        if (table_name === "products") {
          summary = `Xóa sản phẩm: ${oldData?.product_code || ""} ${oldData?.product_name || ""}`;
        } else {
          summary = `Xóa dữ liệu trong ${getTableLabel(table_name)}`;
        }
        break;
    }
    
    return summary;
  };

  const truncateSummary = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const renderExpandedDetails = (activity: any) => {
    const { action, changes } = activity;
    const oldData = changes?.old;
    const newData = changes?.new;
    
    return (
      <TableRow key={`expanded-${activity.id}`}>
        <TableCell colSpan={6} className="p-0">
          <div className="border-2 border-primary bg-primary/5 m-2 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-primary border-b-2 border-primary pb-2 mb-4">
              Chi tiết
            </h3>
            
            <div className="mb-4">
              <p className="text-sm">
                {generateSummary(activity)}
              </p>
            </div>
            
            {action === "update" && oldData && newData && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-destructive mb-2">Giá trị cũ</h4>
                  <div className="bg-destructive/10 border border-destructive/20 rounded p-3 space-y-1">
                    {Object.entries(oldData).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium min-w-[120px]">{getFieldLabel(key)}:</span>
                        <span className="flex-1 break-words">
                          {value === null || value === undefined 
                            ? <span className="text-muted-foreground italic">Không có</span>
                            : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">Giá trị mới</h4>
                  <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                    {Object.entries(newData).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium min-w-[120px]">{getFieldLabel(key)}:</span>
                        <span className="flex-1 break-words">
                          {value === null || value === undefined 
                            ? <span className="text-muted-foreground italic">Không có</span>
                            : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {action === "insert" && newData && (
              <div>
                <h4 className="font-semibold text-green-600 mb-2">Dữ liệu mới</h4>
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                  {Object.entries(newData).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]">{getFieldLabel(key)}:</span>
                      <span className="flex-1 break-words">
                        {value === null || value === undefined 
                          ? <span className="text-muted-foreground italic">Không có</span>
                          : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {action === "delete" && oldData && (
              <div>
                <h4 className="font-semibold text-destructive mb-2">Dữ liệu đã xóa</h4>
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 space-y-1">
                  {Object.entries(oldData).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]">{getFieldLabel(key)}:</span>
                      <span className="flex-1 break-words">
                        {value === null || value === undefined 
                          ? <span className="text-muted-foreground italic">Không có</span>
                          : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
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
              <>
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
                      second: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleRowExpansion(activity.id)}
                      className="flex items-center gap-2 text-left hover:text-primary transition-colors w-full"
                    >
                      {expandedRowId === activity.id ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="text-sm">
                        {truncateSummary(generateSummary(activity))}
                      </span>
                    </button>
                  </TableCell>
                </TableRow>
                
                {expandedRowId === activity.id && renderExpandedDetails(activity)}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
