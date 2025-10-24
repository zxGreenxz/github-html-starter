import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuickAddOrder } from "./QuickAddOrder";
import { X, Search, Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LiveProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  prepared_quantity: number;
  sold_quantity: number;
  image_url?: string;
}

interface LiveOrder {
  id: string;
  session_index: number;
  tpos_order_id?: string | null;
  live_product_id: string;
  quantity: number;
  is_oversell?: boolean;
}

interface FullScreenProductViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: LiveProduct[];
  orders: LiveOrder[];
  selectedPhase: string | null;
  selectedSession: string | null;
}

export function FullScreenProductView({
  open,
  onOpenChange,
  products,
  orders,
  selectedPhase,
  selectedSession,
}: FullScreenProductViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter products by search term
  const filteredProducts = products.filter(product => {
    const search = searchTerm.toLowerCase();
    return (
      product.product_code.toLowerCase().includes(search) ||
      product.product_name.toLowerCase().includes(search) ||
      (product.variant?.toLowerCase() || "").includes(search)
    );
  });

  const getProductOrders = (productId: string) => {
    return orders.filter(order => order.live_product_id === productId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 gap-0 rounded-none">
        {/* Header with search */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-background">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo mã SP, tên sản phẩm, biến thế..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Mã SP</TableHead>
                <TableHead className="min-w-[200px]">Tên sản phẩm</TableHead>
                <TableHead className="w-[120px]">Biến thế</TableHead>
                <TableHead className="w-[80px]">Hình ảnh</TableHead>
                <TableHead className="w-[200px]">Tạo order</TableHead>
                <TableHead className="w-[100px] text-center">SL chuẩn bị</TableHead>
                <TableHead className="w-[100px] text-center">SL đã bán</TableHead>
                <TableHead className="min-w-[250px]">Mã đơn hàng</TableHead>
                <TableHead className="w-[100px] text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Không tìm thấy sản phẩm
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const productOrders = getProductOrders(product.id);
                  const rowSpan = Math.max(1, productOrders.length);
                  const remaining = product.prepared_quantity - product.sold_quantity;

                  return productOrders.length > 0 ? (
                    // Render rows for each order
                    productOrders.map((order, orderIndex) => (
                      <TableRow key={`${product.id}-${order.id}`}>
                        {orderIndex === 0 && (
                          <>
                            <TableCell rowSpan={rowSpan} className="font-medium align-top">
                              {product.product_code}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="align-top">
                              {product.product_name}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="align-top">
                              {product.variant || (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="align-top">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.product_name}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">N/A</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="align-top">
                              <QuickAddOrder
                                productId={product.id}
                                phaseId={selectedPhase || ""}
                                sessionId={selectedSession || ""}
                                availableQuantity={remaining}
                              />
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="text-center align-top">
                              {product.prepared_quantity}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} className="text-center align-top">
                              {product.sold_quantity}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={order.is_oversell ? "text-destructive font-medium" : ""}>
                              {order.session_index}
                            </span>
                            <span className="text-muted-foreground">({order.quantity})</span>
                            {order.tpos_order_id && (
                              <span className="text-xs text-muted-foreground">
                                TPOS: {order.tpos_order_id}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {orderIndex === 0 && (
                          <TableCell rowSpan={rowSpan} className="text-center align-top">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    // Render single row if no orders
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>
                        {product.variant || (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.product_name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">N/A</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <QuickAddOrder
                          productId={product.id}
                          phaseId={selectedPhase || ""}
                          sessionId={selectedSession || ""}
                          availableQuantity={remaining}
                        />
                      </TableCell>
                      <TableCell className="text-center">{product.prepared_quantity}</TableCell>
                      <TableCell className="text-center">{product.sold_quantity}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">Chưa có đơn</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}