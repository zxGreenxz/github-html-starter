import { Book, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export const SystemDocumentation = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Tài Liệu Hệ Thống
          </CardTitle>
          <CardDescription>
            Hướng dẫn chi tiết về cấu trúc và chức năng của hệ thống quản lý bán hàng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Overview */}
            <AccordionItem value="overview">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge>Tổng quan</Badge>
                  <span className="font-semibold">Giới thiệu hệ thống</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">🎯 Mục đích</h4>
                    <p className="text-muted-foreground">
                      Hệ thống quản lý toàn bộ quy trình bán hàng từ đặt hàng nhà cung cấp, 
                      quản lý kho, bán hàng livestream, đến quản lý khách hàng và báo cáo.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">🏗️ Kiến trúc</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>Frontend:</strong> React + TypeScript + Vite</li>
                      <li><strong>Backend:</strong> Supabase (Database + Auth + Edge Functions)</li>
                      <li><strong>Mobile Support:</strong> Responsive design + Capacitor (iOS/Android build ready)</li>
                      <li><strong>UI Library:</strong> shadcn/ui + Tailwind CSS</li>
                      <li><strong>State Management:</strong> React Query + Context API</li>
                      <li><strong>Routing:</strong> React Router v6</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">📁 Cấu trúc thư mục chính</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`src/
├── pages/              # Các trang chính
├── components/         # Components tái sử dụng
│   ├── ui/            # shadcn UI components
│   ├── products/      # Components quản lý sản phẩm
│   ├── purchase-orders/  # Components đặt hàng
│   ├── live-products/ # Components bán live
│   ├── facebook/      # Components Facebook
│   ├── customers/     # Components khách hàng
│   └── settings/      # Components cài đặt
├── contexts/          # React Context providers
├── hooks/             # Custom hooks
├── lib/               # Utility functions
└── integrations/      # Supabase integration`}
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Main Features */}
            <AccordionItem value="features">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Chức năng chính</Badge>
                  <span className="font-semibold">10 trang chính của hệ thống</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 text-sm">
                  {/* Purchase Orders */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">1. 🛒 Đặt Hàng NCC (Purchase Orders)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/purchase-orders</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/PurchaseOrders.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Tạo đơn đặt hàng từ nhà cung cấp</li>
                        <li><strong>Tạo biến thể sản phẩm (Variant Generator):</strong>
                          <ul className="list-circle list-inside ml-4 mt-1">
                            <li>Chọn thuộc tính từ <code>product_attributes</code> và <code>product_attribute_values</code></li>
                            <li>Tính tổng số biến thể (Cartesian Product)</li>
                            <li>Gọi Edge Function <code>create-tpos-variants-from-order</code></li>
                            <li>Tự động tạo parent + children trên TPOS</li>
                            <li>Lưu <code>tpos_product_id</code> và <code>productid_bienthe</code> vào database</li>
                          </ul>
                        </li>
                        <li>Upload hình ảnh sản phẩm</li>
                        <li>Import sản phẩm từ Excel</li>
                        <li><strong>Export 2 loại Excel:</strong>
                          <ul className="list-circle list-inside ml-4 mt-1">
                            <li><code>TaoMaSP_&#123;dd-mm&#125;.xlsx</code>: Template TPOS (17 columns)</li>
                            <li><code>MuaHang_&#123;Supplier&#125;_&#123;dd-mm&#125;.xlsx</code>: Import TPOS (4 columns)</li>
                          </ul>
                        </li>
                        <li>Quản lý trạng thái: draft, pending, completed</li>
                        <li>Goods Receiving: Kiểm hàng và cập nhật tồn kho</li>
                        <li>Đồng bộ với TPOS (thông qua tpos_product_id)</li>
                        <li>Thống kê: Tổng đơn, giá trị, đơn hôm nay</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>purchase_orders</code> - Đơn đặt hàng</li>
                        <li><code>purchase_order_items</code> - Chi tiết sản phẩm trong đơn</li>
                      </ul>
                    </div>
                  </div>

                  {/* Goods Receiving */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">2. 📦 Kiểm Hàng (Goods Receiving)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/goods-receiving</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/GoodsReceiving.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Tạo phiếu kiểm hàng từ đơn đặt hàng</li>
                        <li>Nhập số lượng thực nhận cho từng sản phẩm</li>
                        <li>Tự động cập nhật tồn kho vào bảng products</li>
                        <li>Quản lý trạng thái: pending, partial, completed</li>
                        <li>Thống kê số lượng đã nhận vs đặt hàng</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>goods_receiving</code> - Phiếu kiểm hàng</li>
                        <li><code>goods_receiving_items</code> - Chi tiết kiểm hàng</li>
                        <li><code>products</code> - Cập nhật stock_quantity</li>
                      </ul>
                    </div>
                  </div>

                  {/* Live Products */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">3. 📹 Order Live (Live Products)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/live-products</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/LiveProducts.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Tạo phiên live theo ngày (3 ngày x 2 ca = 6 phases)</li>
                        <li>Thêm sản phẩm vào phiên live</li>
                        <li>Quick add order bằng session index</li>
                        <li>Quản lý số lượng chuẩn bị và đã bán</li>
                        <li>Cảnh báo oversell (vượt số lượng chuẩn bị)</li>
                        <li>Tích hợp Facebook comment để lấy đơn tự động</li>
                        <li>Tự động in bill đơn hàng</li>
                        <li>Thống kê theo sản phẩm và theo đơn hàng</li>
                        <li>Ghi chú cho từng đơn hàng</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>live_sessions</code> - Phiên live</li>
                        <li><code>live_phases</code> - Các ca trong phiên (sáng/chiều)</li>
                        <li><code>live_products</code> - Sản phẩm trong phiên live</li>
                        <li><code>live_orders</code> - Đơn hàng từ live</li>
                      </ul>
                    </div>
                  </div>

                  {/* Facebook Comments */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">4. 💬 Livestream Comment (Facebook Comments)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/facebook-comments</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/FacebookComments.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Quản lý Facebook Pages và access tokens</li>
                        <li>Fetch comments từ Facebook Live Video</li>
                        <li>Lưu trữ comment archive để tracking realtime</li>
                        <li>Gán session_index cho từng user</li>
                        <li>Phát hiện sản phẩm từ comment (barcode scanning)</li>
                        <li>Tự động tạo đơn hàng từ comment</li>
                        <li>Realtime sync với database</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>facebook_pages</code> - Danh sách pages</li>
                        <li><code>facebook_comments_archive</code> - Lưu trữ comments</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Edge Functions:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>facebook-comments</code> - Fetch comments từ FB API</li>
                        <li><code>facebook-livevideo</code> - Lấy thông tin live video</li>
                      </ul>
                    </div>
                  </div>

                  {/* Livestream Reports */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">5. 📊 Báo Cáo Livestream (Livestream Reports)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/livestream-reports</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/LivestreamReports.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Tạo báo cáo livestream theo ngày</li>
                        <li>Nhập số liệu: view, viewer, tương tác, đơn hàng</li>
                        <li>Tính tỷ lệ chuyển đổi (conversion rate)</li>
                        <li>So sánh hiệu suất giữa các livestream</li>
                        <li>Ghi chú và đánh giá livestream</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>livestream_reports</code> - Báo cáo livestream</li>
                      </ul>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">6. 🏪 Kho Sản Phẩm (Products)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/products</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/Products.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Quản lý toàn bộ sản phẩm trong kho</li>
                        <li>CRUD operations: Create, Read, Update, Delete</li>
                        <li>Tìm kiếm theo mã, tên, barcode</li>
                        <li>Lọc theo nhà cung cấp</li>
                        <li>Quản lý tồn kho (stock_quantity)</li>
                        <li>Upload nhiều ảnh cho mỗi sản phẩm</li>
                        <li>Import từ TPOS (search và import)</li>
                        <li>Import từ Excel</li>
                        <li>Sync TPOS Product IDs (productid_bienthe)</li>
                        <li>Thống kê tồn kho theo nhà cung cấp</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>products</code> - Sản phẩm chính</li>
                      </ul>
                    </div>
                  </div>

                  {/* Customers */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">7. 👥 Kho Khách Hàng (Customers)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/customers</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/Customers.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Quản lý thông tin khách hàng</li>
                        <li>Lưu Facebook ID để mapping với comments</li>
                        <li>Quản lý trạng thái khách hàng (bom_hang, thieu_thong_tin)</li>
                        <li>Fetch thông tin từ TPOS CRM</li>
                        <li>Import khách hàng hàng loạt từ Excel</li>
                        <li>Tìm kiếm theo tên, SĐT, Facebook ID</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>customers</code> - Thông tin khách hàng</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Edge Functions:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>fetch-tpos-customer-detail</code> - Lấy thông tin KH từ TPOS</li>
                        <li><code>fetch-tpos-customer-details-batch</code> - Batch fetch</li>
                      </ul>
                    </div>
                  </div>

                  {/* Search Products */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">8. 🔍 Tìm Kiếm SP (Search Products)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/search-products</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/SearchProducts.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Tìm kiếm nhanh sản phẩm</li>
                        <li>Hỗ trợ barcode scanner</li>
                        <li>Hiển thị thông tin chi tiết sản phẩm</li>
                        <li>Quick view ảnh và giá</li>
                      </ul>
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">9. 📜 Lịch Sử Chỉnh Sửa (Activity Log)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/activity-log</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/ActivityLog.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Theo dõi mọi thay đổi trong hệ thống</li>
                        <li>Ghi log INSERT, UPDATE, DELETE</li>
                        <li>Hiển thị thông tin user thực hiện</li>
                        <li>So sánh giá trị cũ và mới (JSON diff)</li>
                        <li>Lọc theo table, action, user, ngày</li>
                        <li>Thống kê số lượng activities</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Tables:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>activity_logs</code> - Log mọi thay đổi</li>
                      </ul>
                      <p className="font-medium mt-2 mb-1">Database Function:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li><code>log_activity()</code> - Trigger function tự động log</li>
                      </ul>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold mb-2">10. ⚙️ Cài Đặt (Settings)</h4>
                    <p className="text-muted-foreground mb-2">
                      <strong>Route:</strong> <code className="bg-muted px-1 py-0.5 rounded">/settings</code>
                    </p>
                    <p className="text-muted-foreground mb-2">
                      <strong>File:</strong> <code className="bg-muted px-1 py-0.5 rounded">src/pages/Settings.tsx</code>
                    </p>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Chức năng:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>TPOS Credentials:</strong> Quản lý Bearer Token</li>
                        <li><strong>Barcode Scanner:</strong> Cấu hình quét mã vạch</li>
                        <li><strong>Printer Config:</strong> Cấu hình máy in bill</li>
                        <li><strong>TPOS API Reference:</strong> Tài liệu API</li>
                        <li><strong>System Documentation:</strong> Tài liệu hệ thống (trang này)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Database Schema */}
            <AccordionItem value="database">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Database</Badge>
                  <span className="font-semibold">Cấu trúc Database</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">📊 Các bảng chính</h4>
                    <div className="space-y-2">
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">products</code>
                        <p className="text-xs text-muted-foreground mt-1">Sản phẩm trong kho (product_code, product_name, stock_quantity, tpos_product_id, productid_bienthe, base_product_code)</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">product_attributes</code> + <code className="font-bold">product_attribute_values</code>
                        <p className="text-xs text-muted-foreground mt-1">Kho thuộc tính và giá trị (Size, Color, etc.) - Có tpos_id để sync với TPOS</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">purchase_orders</code> + <code className="font-bold">purchase_order_items</code>
                        <p className="text-xs text-muted-foreground mt-1">Đơn đặt hàng và chi tiết sản phẩm</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">goods_receiving</code> + <code className="font-bold">goods_receiving_items</code>
                        <p className="text-xs text-muted-foreground mt-1">Phiếu kiểm hàng và chi tiết nhập kho</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">live_sessions</code> + <code className="font-bold">live_phases</code> + <code className="font-bold">live_products</code> + <code className="font-bold">live_orders</code>
                        <p className="text-xs text-muted-foreground mt-1">Phiên live, các ca, sản phẩm, và đơn hàng</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">livestream_reports</code>
                        <p className="text-xs text-muted-foreground mt-1">Báo cáo livestream (views, viewers, orders, conversion rate)</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">customers</code>
                        <p className="text-xs text-muted-foreground mt-1">Thông tin khách hàng (facebook_id, phone, customer_status)</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">facebook_pages</code> + <code className="font-bold">facebook_comments_archive</code>
                        <p className="text-xs text-muted-foreground mt-1">Facebook pages và comments từ livestream</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">activity_logs</code>
                        <p className="text-xs text-muted-foreground mt-1">Log mọi thay đổi trong hệ thống</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <code className="font-bold">tpos_credentials</code>
                        <p className="text-xs text-muted-foreground mt-1">Lưu Bearer Token TPOS và Facebook</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">🔐 Row Level Security (RLS)</h4>
                    <p className="text-muted-foreground">
                      Tất cả các bảng đều có RLS policies để bảo mật dữ liệu. 
                      User chỉ có thể truy cập dữ liệu thuộc về họ hoặc công khai.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Edge Functions */}
            <AccordionItem value="edge-functions">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Edge Functions</Badge>
                  <span className="font-semibold">Supabase Edge Functions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  {[
                    {
                      name: "check-tpos-credentials",
                      desc: "Kiểm tra tính hợp lệ của TPOS Bearer Token"
                    },
                    {
                      name: "check-tpos-images",
                      desc: "Kiểm tra hình ảnh sản phẩm trên TPOS"
                    },
                    {
                      name: "create-tpos-order-from-comment",
                      desc: "Tạo đơn hàng tự động từ Facebook comment"
                    },
                    {
                      name: "create-tpos-variants",
                      desc: "Tạo biến thể sản phẩm trên TPOS (deprecated, dùng create-tpos-variants-from-order)"
                    },
                    {
                      name: "create-tpos-variants-from-order",
                      desc: "Tạo biến thể sản phẩm trên TPOS từ Purchase Order với AttributeLines"
                    },
                    {
                      name: "facebook-comments",
                      desc: "Fetch comments từ Facebook Live Video API"
                    },
                    {
                      name: "facebook-livevideo",
                      desc: "Lấy thông tin chi tiết về live video"
                    },
                    {
                      name: "fetch-crm-teams",
                      desc: "Lấy danh sách CRM teams từ TPOS"
                    },
                    {
                      name: "fetch-facebook-orders",
                      desc: "Lấy đơn hàng từ Facebook"
                    },
                    {
                      name: "fetch-tpos-customer-detail",
                      desc: "Lấy thông tin chi tiết khách hàng từ TPOS"
                    },
                    {
                      name: "fetch-tpos-customer-details-batch",
                      desc: "Lấy thông tin nhiều khách hàng cùng lúc"
                    },
                    {
                      name: "refresh-tpos-token",
                      desc: "Làm mới TPOS Bearer Token khi hết hạn"
                    },
                    {
                      name: "sync-attribute-value-to-tpos",
                      desc: "Đồng bộ giá trị thuộc tính lên TPOS (attribute values)"
                    },
                    {
                      name: "sync-tpos-images",
                      desc: "Đồng bộ hình ảnh từ TPOS"
                    },
                    {
                      name: "sync-tpos-orders-status",
                      desc: "Đồng bộ trạng thái đơn hàng từ TPOS"
                    }
                  ].map(func => (
                    <div key={func.name} className="bg-muted/50 p-3 rounded">
                      <code className="font-bold text-primary">{func.name}</code>
                      <p className="text-xs text-muted-foreground mt-1">{func.desc}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* API Endpoints */}
            <AccordionItem value="api-endpoints">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">API Documentation</Badge>
                  <span className="font-semibold">Chi tiết API Endpoints</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 text-sm">
                  {/* TPOS API */}
                  <div>
                    <h4 className="font-semibold mb-3 text-base">🔷 TPOS API (https://tomato.tpos.vn)</h4>
                    
                    <div className="space-y-4">
                      {/* Authentication */}
                      <div className="border-l-2 border-primary pl-4">
                        <h5 className="font-semibold mb-2">Authentication</h5>
                        <div className="bg-muted/50 p-3 rounded">
                          <code className="text-xs">POST /token</code>
                          <p className="text-xs text-muted-foreground mt-1">
                            Lấy Bearer Token (grant_type: password)
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Used by:</strong> <code>refresh-tpos-token</code> Edge Function
                          </p>
                        </div>
                      </div>

                      {/* Product APIs */}
                      <div className="border-l-2 border-blue-500 pl-4">
                        <h5 className="font-semibold mb-2">Product APIs</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/Product/OdataService.GetViewV2</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Search/List products (variants)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Params:</strong> $filter, $top, $skip, $orderby, $expand, $count
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>searchTPOSProduct()</code>, <code>syncTPOSProductIds()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/ProductTemplate/ODataService.GetViewV2</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Search/List product templates (parent products)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetchTPOSProducts()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/ProductTemplate(&#123;id&#125;)?$expand=UOM,Categ,Images,ProductVariants($expand=AttributeValues)</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get parent product detail with all variants
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetchTPOSProductDetail()</code>, <code>getProductDetail()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/Product(&#123;productid_bienthe&#125;)?$expand=UOM,Categ,AttributeValues</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get variant detail
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetchTPOSVariantDetail()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded border-l-4 border-green-500">
                            <code className="text-xs font-bold">POST /odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Create Product with Variants (Main Upload API)</strong>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Body: Full product payload với AttributeLines, ProductVariants, Base64 images
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>create-tpos-variants-from-order</code> Edge Function, <code>createProductDirectly()</code>
                            </p>
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
{`// Example payload structure
{
  "Name": "Product Name",
  "DefaultCode": "PRD001",
  "Type": "product",
  "ListPrice": 150000,
  "PurchasePrice": 100000,
  "Image": "base64string...",
  "AttributeLines": [
    {
      "AttributeId": 1,
      "ValueIds": [10, 11, 12]
    }
  ],
  "ProductVariants": [
    {
      "NameGet": "Product (Size M)",
      "PriceVariant": 150000,
      "AttributeValues": [10]
    }
  ]
}`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Order APIs */}
                      <div className="border-l-2 border-orange-500 pl-4">
                        <h5 className="font-semibold mb-2">Order APIs</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/SaleOnline_Order/ODataService.GetView</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              List orders (filter by DateCreated, SessionIndex)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetchTPOSOrdersBySessionIndex()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/SaleOnline_Order(&#123;id&#125;)?$expand=Details,Partner,User,CRMTeam</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get order details with expanded relations
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetchTPOSOrderDetails()</code>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CRM APIs */}
                      <div className="border-l-2 border-purple-500 pl-4">
                        <h5 className="font-semibold mb-2">CRM APIs</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/CRMTeam?$top=100&$orderby=Name desc</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get CRM teams list
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetch-crm-teams</code> Edge Function
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /odata/Partner(&#123;idkh&#125;)?$expand=State,Country,CommercialCompany,City,District,Ward</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get customer detail with location info
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>fetch-tpos-customer-detail</code>, <code>fetch-tpos-customer-details-batch</code>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Image Sync */}
                      <div className="border-l-2 border-pink-500 pl-4">
                        <h5 className="font-semibold mb-2">Image Sync APIs</h5>
                        <div className="bg-muted/50 p-3 rounded">
                          <p className="text-xs text-muted-foreground">
                            Uses Product APIs above to fetch batch products and compare image data
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Used by:</strong> <code>check-tpos-images</code>, <code>sync-tpos-images</code> Edge Functions
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Facebook Graph API */}
                  <div>
                    <h4 className="font-semibold mb-3 text-base">📘 Facebook Graph API (https://graph.facebook.com)</h4>
                    
                    <div className="space-y-4">
                      {/* Authentication */}
                      <div className="border-l-2 border-primary pl-4">
                        <h5 className="font-semibold mb-2">Authentication</h5>
                        <div className="bg-muted/50 p-3 rounded">
                          <p className="text-xs text-muted-foreground">
                            Token stored in <code>tpos_credentials</code> table (token_type: 'facebook')
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Access via: <code>getActiveFacebookToken()</code>
                          </p>
                        </div>
                      </div>

                      {/* Live Video APIs */}
                      <div className="border-l-2 border-blue-500 pl-4">
                        <h5 className="font-semibold mb-2">Live Video APIs</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /&#123;video_id&#125;/comments</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Fetch comments from live video
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Params:</strong> access_token, fields, limit
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>facebook-comments</code> Edge Function
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET /&#123;video_id&#125;</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Get live video info
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Fields:</strong> live_views, status, description, created_time
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>facebook-livevideo</code> Edge Function
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Page Management */}
                      <div className="border-l-2 border-purple-500 pl-4">
                        <h5 className="font-semibold mb-2">Page Management</h5>
                        <div className="bg-muted/50 p-3 rounded">
                          <p className="text-xs text-muted-foreground">
                            Pages stored in <code>facebook_pages</code> table
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Used for:</strong> Comment tracking, order creation from comments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bridge Server */}
                  <div>
                    <h4 className="font-semibold mb-3 text-base">🖨️ Internal Bridge Server (Local Network)</h4>
                    
                    <div className="space-y-4">
                      <div className="border-l-2 border-green-500 pl-4">
                        <h5 className="font-semibold mb-2">Print APIs</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">POST &#123;bridgeUrl&#125;/print/html</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Send HTML content to printer
                            </p>
                            <pre className="text-xs bg-muted p-2 rounded mt-2">
{`Body: {
  html: string,
  width: number,
  height: number,
  scale: number
}`}
                            </pre>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>sendPrintJobToNetwork()</code>
                            </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <code className="text-xs">GET &#123;bridgeUrl&#125;/health</code>
                            <p className="text-xs text-muted-foreground mt-1">
                              Check bridge server status
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Used by:</strong> <code>testBridgeConnection()</code>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-3 rounded">
                        <p className="text-xs font-medium">Configuration</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Managed in <code>PrinterConfigManager</code> component
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Example: <code>http://192.168.1.100:3000</code>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* API Request Headers */}
                  <div>
                    <h4 className="font-semibold mb-3 text-base">📋 API Request Headers</h4>
                    
                    <div className="space-y-4">
                      <div className="border-l-2 border-primary pl-4">
                        <h5 className="font-semibold mb-2">TPOS Headers (Common)</h5>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`{
  'accept': 'application/json',
  'authorization': 'Bearer {token}',
  'content-type': 'application/json;charset=UTF-8',
  'x-tpos-lang': 'vi',
  'tposappversion': '5.9.10.1',
  'x-request-id': '{uuid}',
  'user-agent': 'Mozilla/5.0...'
}`}
                        </pre>
                        <p className="text-xs text-muted-foreground mt-2">
                          Generated by: <code>getTPOSHeaders(bearerToken)</code> in <code>src/lib/tpos-config.ts</code>
                        </p>
                      </div>

                      <div className="border-l-2 border-orange-500 pl-4">
                        <h5 className="font-semibold mb-2">Rate Limiting</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-xs font-medium">TPOS API</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Delay: 200-600ms between requests (configured per function)
                            </p>
                          </div>
                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-xs font-medium">Facebook Batch Requests</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Delay: 200ms between customer fetches
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Token Management */}
                  <div>
                    <h4 className="font-semibold mb-3 text-base">🔑 Token Management</h4>
                    
                    <div className="space-y-4">
                      <div className="border-l-2 border-primary pl-4">
                        <h5 className="font-semibold mb-2">Storage</h5>
                        <div className="bg-muted/50 p-3 rounded">
                          <p className="text-xs font-medium">Table: <code>tpos_credentials</code></p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Columns: <code>token_type</code> ('tpos' | 'facebook'), <code>bearer_token</code>, <code>username</code>, <code>password</code>
                          </p>
                        </div>
                      </div>

                      <div className="border-l-2 border-green-500 pl-4">
                        <h5 className="font-semibold mb-2">Refresh Flow</h5>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                          <li>User triggers refresh in Settings page</li>
                          <li><code>refresh-tpos-token</code> Edge Function called</li>
                          <li>POST to TPOS <code>/token</code> endpoint with credentials</li>
                          <li>Update <code>bearer_token</code> in database</li>
                        </ol>
                      </div>

                      <div className="border-l-2 border-blue-500 pl-4">
                        <h5 className="font-semibold mb-2">Token Usage</h5>
                        <div className="space-y-2">
                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-xs font-medium">Frontend</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Functions: <code>getActiveTPOSToken()</code>, <code>getActiveFacebookToken()</code>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Location: <code>src/lib/tpos-config.ts</code>
                            </p>
                          </div>
                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-xs font-medium">Edge Functions</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Query from <code>tpos_credentials</code> table directly
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Key Features */}
            <AccordionItem value="key-features">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Tính năng nổi bật</Badge>
                  <span className="font-semibold">Các tính năng đặc biệt</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div className="border-l-2 border-green-500 pl-4">
                    <h4 className="font-semibold mb-2">✅ TPOS Integration</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Tìm kiếm và import sản phẩm từ TPOS</li>
                      <li>Đồng bộ TPOS Product IDs (productid_bienthe)</li>
                      <li>Tự động refresh token khi hết hạn</li>
                      <li>Fetch thông tin khách hàng từ CRM</li>
                      <li>Sync hình ảnh và trạng thái đơn hàng</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-blue-500 pl-4">
                    <h4 className="font-semibold mb-2">📱 Facebook Live Integration</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Realtime comment tracking</li>
                      <li>Tự động gán session_index cho user</li>
                      <li>Tạo đơn hàng tự động từ comment</li>
                      <li>Phát hiện sản phẩm qua barcode trong comment</li>
                      <li>Sidebar realtime comments trong Live Products</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-purple-500 pl-4">
                    <h4 className="font-semibold mb-2">🖨️ Auto Print Bills</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Tự động in bill khi tạo đơn mới (có thể bật/tắt)</li>
                      <li>Print queue system để quản lý in hàng loạt</li>
                      <li>Generate order image với QR code</li>
                      <li>Cấu hình printer trong Settings</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-orange-500 pl-4">
                    <h4 className="font-semibold mb-2">📊 Barcode Scanner</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Quét barcode để tìm sản phẩm nhanh</li>
                      <li>Enable/disable cho từng page</li>
                      <li>Tự động focus vào search box</li>
                      <li>Hỗ trợ nhiều loại barcode scanner</li>
                    </ul>
                  </div>

                  <div className="border-l-2 border-red-500 pl-4">
                    <h4 className="font-semibold mb-2">📈 Real-time Statistics</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Thống kê tồn kho theo nhà cung cấp</li>
                      <li>Thống kê đơn hàng theo ngày/tháng</li>
                      <li>Thống kê livestream performance</li>
                      <li>Activity tracking và audit log</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tech Stack */}
            <AccordionItem value="tech-stack">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge>Tech Stack</Badge>
                  <span className="font-semibold">Công nghệ sử dụng</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">🎨 Frontend</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>React 18:</strong> UI framework</li>
                      <li><strong>TypeScript:</strong> Type safety</li>
                      <li><strong>Vite:</strong> Build tool</li>
                      <li><strong>Tailwind CSS:</strong> Styling</li>
                      <li><strong>shadcn/ui:</strong> Component library</li>
                      <li><strong>React Router v6:</strong> Routing</li>
                      <li><strong>React Query:</strong> Server state management</li>
                      <li><strong>Lucide Icons:</strong> Icon library</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">🔧 Backend & Services</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>Supabase:</strong> Backend as a Service</li>
                      <li><strong>PostgreSQL:</strong> Database</li>
                      <li><strong>Edge Functions:</strong> Serverless API</li>
                      <li><strong>Supabase Auth:</strong> Authentication</li>
                      <li><strong>Supabase Storage:</strong> File storage</li>
                      <li><strong>Realtime:</strong> WebSocket subscriptions</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">🔌 External APIs</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>TPOS API:</strong> POS system integration</li>
                      <li><strong>Facebook Graph API:</strong> Facebook integration</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">📦 Key Libraries</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>date-fns:</strong> Date formatting</li>
                      <li><strong>zod:</strong> Schema validation</li>
                      <li><strong>react-hook-form:</strong> Form management</li>
                      <li><strong>sonner:</strong> Toast notifications</li>
                      <li><strong>xlsx:</strong> Excel import/export</li>
                      <li><strong>jspdf:</strong> PDF generation</li>
                      <li><strong>react-barcode:</strong> Barcode generation</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contexts & Providers */}
            <AccordionItem value="contexts">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Context API</Badge>
                  <span className="font-semibold">Global State Management</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  {[
                    {
                      name: "AuthContext",
                      file: "src/contexts/AuthContext.tsx",
                      desc: "Quản lý authentication state (user, signIn, signOut)"
                    },
                    {
                      name: "BarcodeScannerContext",
                      file: "src/contexts/BarcodeScannerContext.tsx",
                      desc: "Quản lý barcode scanner (enable/disable per page, scan events)"
                    },
                    {
                      name: "CommentsSidebarContext",
                      file: "src/contexts/CommentsSidebarContext.tsx",
                      desc: "Quản lý sidebar Facebook comments trong Live Products"
                    },
                    {
                      name: "PrintQueueContext",
                      file: "src/contexts/PrintQueueContext.tsx",
                      desc: "Quản lý print queue (add to queue, print status)"
                    },
                    {
                      name: "RealtimeProvider",
                      file: "src/components/RealtimeProvider.tsx",
                      desc: "Setup Supabase realtime subscriptions"
                    }
                  ].map(ctx => (
                    <div key={ctx.name} className="bg-muted/50 p-3 rounded">
                      <code className="font-bold text-primary">{ctx.name}</code>
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>File:</strong> {ctx.file}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{ctx.desc}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Development Guide */}
            <AccordionItem value="development">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Development</Badge>
                  <span className="font-semibold">Hướng dẫn phát triển</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">🚀 Setup môi trường</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`# Clone repository
git clone <repo-url>

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env với Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">📝 Thêm tính năng mới</h4>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>
                        <strong>Tạo page mới:</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Tạo file trong <code>src/pages/</code></li>
                          <li>Thêm route trong <code>src/App.tsx</code></li>
                          <li>Thêm menu item trong <code>src/components/AppSidebar.tsx</code></li>
                        </ul>
                      </li>
                      <li>
                        <strong>Tạo component:</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Tạo file trong <code>src/components/[feature]/</code></li>
                          <li>Sử dụng shadcn/ui components</li>
                          <li>Follow naming convention: PascalCase</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Database changes:</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Tạo migration file trong <code>supabase/migrations/</code></li>
                          <li>Chạy migration: <code>supabase db push</code></li>
                          <li>Regenerate types: <code>supabase gen types typescript</code></li>
                        </ul>
                      </li>
                      <li>
                        <strong>Edge Functions:</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Tạo function trong <code>supabase/functions/</code></li>
                          <li>Deploy: <code>supabase functions deploy [name]</code></li>
                          <li>Set secrets: <code>supabase secrets set KEY=value</code></li>
                        </ul>
                      </li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">✅ Best Practices</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Sử dụng TypeScript cho type safety</li>
                      <li>Tạo reusable components</li>
                      <li>Sử dụng React Query cho data fetching</li>
                      <li>Implement error handling và loading states</li>
                      <li>Viết comments cho logic phức tạp</li>
                      <li>Follow responsive design principles</li>
                      <li>Optimize images và assets</li>
                      <li>Sử dụng environment variables cho secrets</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
