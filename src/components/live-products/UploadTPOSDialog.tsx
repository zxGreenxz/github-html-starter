import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";

interface UploadTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onUploadComplete: () => void;
}

interface OrderToUpload {
  session_index: number;
  tpos_order_id: string | null;
  code_tpos_order_id: string | null;
  upload_status: string | null;
  product_count: number;
  total_quantity: number;
}

export function UploadTPOSDialog({ open, onOpenChange, sessionId, onUploadComplete }: UploadTPOSDialogProps) {
  const [selectedSessionIndexes, setSelectedSessionIndexes] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const queryClient = useQueryClient();

  // Fetch orders with code_tpos_order_id
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['upload-tpos-orders', sessionId],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from('live_orders')
        .select('session_index, tpos_order_id, code_tpos_order_id, upload_status, quantity')
        .eq('live_session_id', sessionId)
        .not('code_tpos_order_id', 'is', null);

      if (error) throw error;

      // Group by session_index and calculate stats
      const groupedOrders = ordersData.reduce((acc, order) => {
        if (!acc[order.session_index]) {
          acc[order.session_index] = {
            session_index: order.session_index,
            tpos_order_id: order.tpos_order_id,
            code_tpos_order_id: order.code_tpos_order_id,
            upload_status: order.upload_status,
            product_count: 0,
            total_quantity: 0,
          };
        }
        acc[order.session_index].product_count += 1;
        acc[order.session_index].total_quantity += order.quantity;
        return acc;
      }, {} as Record<number, OrderToUpload>);

      return Object.values(groupedOrders);
    },
    enabled: open && !!sessionId,
  });

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedSessionIndexes(new Set());
      setUploadProgress({ current: 0, total: 0 });
    }
  }, [open]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessionIndexes(new Set(orders.map(o => o.session_index)));
    } else {
      setSelectedSessionIndexes(new Set());
    }
  };

  const handleSelectOrder = (sessionIndex: number, checked: boolean) => {
    const newSelection = new Set(selectedSessionIndexes);
    if (checked) {
      newSelection.add(sessionIndex);
    } else {
      newSelection.delete(sessionIndex);
    }
    setSelectedSessionIndexes(newSelection);
  };

  /**
   * Resolve Product ID cho TPOS
   * LUÔN LUÔN tìm trên TPOS bằng DefaultCode = product_code
   * KHÔNG dùng cache từ DB (productid_bienthe, tpos_product_id)
   */
  const resolveProductId = async (
    product: { 
      product_code: string; 
      productid_bienthe: number | null; 
      tpos_product_id: number | null;
      variant: string | null;
    },
    token: string
  ): Promise<{ productId: number; source: string }> => {
    
    console.log(`🔍 ${product.product_code}: Searching TPOS by DefaultCode...`);
    
    // LUÔN LUÔN tìm trên TPOS
    const searchUrl = `https://tomato.tpos.vn/odata/Product/ODataService.GetViewV2?$filter=DefaultCode eq '${product.product_code}'&$select=Id,DefaultCode,Name&$top=1`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: getTPOSHeaders(token)
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Không thể tìm sản phẩm ${product.product_code} trên TPOS (HTTP ${searchResponse.status})`);
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.value || searchData.value.length === 0) {
      throw new Error(`Sản phẩm ${product.product_code} không tồn tại trên TPOS. Vui lòng tạo sản phẩm trên TPOS trước.`);
    }
    
    const tposProduct = searchData.value[0];
    console.log(`✅ ${product.product_code}: Found ProductId=${tposProduct.Id} (${tposProduct.Name})`);
    
    return { 
      productId: tposProduct.Id, 
      source: 'TPOS Search (DefaultCode)' 
    };
  };

  const handleUploadSelected = async () => {
    if (selectedSessionIndexes.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 đơn hàng");
      return;
    }

    setIsUploading(true);
    const ordersToUpload = Array.from(selectedSessionIndexes);
    setUploadProgress({ current: 0, total: ordersToUpload.length });

    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Không tìm thấy TPOS Bearer Token");
      }

      for (let i = 0; i < ordersToUpload.length; i++) {
        const sessionIndex = ordersToUpload[i];
        setUploadProgress({ current: i + 1, total: ordersToUpload.length });

        try {
          // BƯỚC 1: Lấy code_tpos_order_id
        const { data: orderData, error: orderError } = await supabase
          .from('live_orders')
          .select('code_tpos_order_id, id')
          .eq('session_index', sessionIndex)
          .limit(1)
          .maybeSingle();

          if (orderError) throw orderError;
          if (!orderData.code_tpos_order_id) {
            throw new Error("Không tìm thấy code_tpos_order_id");
          }

          const orderId = orderData.code_tpos_order_id;

          // BƯỚC 2: GET từ TPOS
          const getResponse = await fetch(
            `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`,
            { 
              method: 'GET',
              headers: getTPOSHeaders(token) 
            }
          );

          if (!getResponse.ok) {
            const errorText = await getResponse.text();
            throw new Error(`GET failed (${getResponse.status}): ${errorText}`);
          }

          const currentOrderData = await getResponse.json();

          // BƯỚC 3: Lấy products từ DB
          const { data: liveOrdersData, error: liveOrdersError } = await supabase
            .from('live_orders')
            .select(`
              quantity,
              live_products!inner(
                product_code,
                product_name
              )
            `)
            .eq('session_index', sessionIndex)
            .eq('live_session_id', sessionId);

          if (liveOrdersError) throw liveOrdersError;

          // Lấy product_code để query products table
          const productCodes = liveOrdersData.map(p => p.live_products.product_code);
          const { data: dbProducts, error: dbProductsError } = await supabase
            .from('products')
            .select('product_code, productid_bienthe, product_name, selling_price, variant, tpos_product_id')
            .in('product_code', productCodes);

          if (dbProductsError) throw dbProductsError;

          // Map data và GROUP BY product_code để gộp số lượng
          const productsMap = new Map<string, {
            productId: number;
            productName: string;
            productNameGet: string;
            quantity: number;
            price: number;
          }>();

          for (const liveOrder of liveOrdersData) {
            const product = dbProducts.find(
              db => db.product_code === liveOrder.live_products.product_code
            );
            
            if (!product) {
              throw new Error(`Không tìm thấy sản phẩm ${liveOrder.live_products.product_code} trong DB`);
            }

            const productCode = liveOrder.live_products.product_code;
            
            if (productsMap.has(productCode)) {
              // Đã resolve rồi, chỉ cộng thêm quantity
              const existing = productsMap.get(productCode)!;
              existing.quantity += liveOrder.quantity;
            } else {
              // Chưa có → resolve Product ID
              let resolvedProductId: number;
              
              try {
                const resolved = await resolveProductId(product, token);
                resolvedProductId = resolved.productId;
                console.log(`✅ ${productCode}: ProductId=${resolvedProductId} (${resolved.source})`);
              } catch (resolveError: any) {
                console.error(`❌ ${productCode}:`, resolveError.message);
                throw new Error(`Sản phẩm ${productCode}: ${resolveError.message}`);
              }
              
              // Tạo mới entry trong Map
              productsMap.set(productCode, {
                productId: resolvedProductId,
                productName: product.product_name,
                productNameGet: `[${product.product_code}] ${product.product_name}`,
                quantity: liveOrder.quantity,
                price: product.selling_price || 0
              });
            }
          }

          // Chuyển Map thành Details array
          const detailsArray = Array.from(productsMap.values()).map(item => ({
            ProductId: item.productId,
            ProductName: item.productName,
            ProductNameGet: item.productNameGet,
            UOMId: 1,
            UOMName: "Cái",
            Quantity: item.quantity,
            Price: item.price,
            Factor: 1,
            ProductWeight: 0
          }));

          // BƯỚC 4: Tạo PUT payload - CHỈ chứa sản phẩm mới từ DB
          const updatePayload = {
            ...currentOrderData,
            PrintCount: (currentOrderData.PrintCount || 0) + 1,
            UserName: "nv20",
            Details: detailsArray // CHỈ sản phẩm mới
          };

          // Xóa @odata.context
          delete updatePayload['@odata.context'];

          // BƯỚC 5: PUT lên TPOS
          const putResponse = await fetch(
            `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`,
            {
              method: 'PUT',
              headers: getTPOSHeaders(token),
              body: JSON.stringify(updatePayload)
            }
          );

          if (!putResponse.ok) {
            const errorText = await putResponse.text();
            throw new Error(`PUT failed (${putResponse.status}): ${errorText}`);
          }

          // BƯỚC 6: Update DB - SUCCESS
          const { error: updateError } = await supabase
            .from('live_orders')
            .update({
              uploaded_at: new Date().toISOString(),
              upload_status: 'success'
            })
            .eq('session_index', sessionIndex);

          if (updateError) throw updateError;

          // Auto-create variants on TPOS for products with variants
          console.log('🔄 Checking for products with variants...');
          const productsWithVariants = dbProducts.filter(p => p.variant && p.tpos_product_id && !p.productid_bienthe);
          
          if (productsWithVariants.length > 0) {
            console.log(`Found ${productsWithVariants.length} products needing variant creation`);
            for (const product of productsWithVariants) {
              try {
                console.log(`Creating variant for ${product.product_code} (${product.variant})...`);
                const { createTPOSVariants } = await import("@/lib/tpos-variant-creator");
                await createTPOSVariants(
                  product.tpos_product_id,
                  product.variant,
                  (msg) => console.log(`  ${msg}`)
                );
                console.log(`✅ Created variant for ${product.product_code}`);
              } catch (variantError) {
                console.error(`⚠️ Failed to create variant for ${product.product_code}:`, variantError);
                // Don't fail the whole upload if variant creation fails
              }
            }
          }

          // Log activity (activity_logs trigger will handle this automatically)

          console.log(`✅ Upload thành công đơn ${sessionIndex}`);

        } catch (error) {
          // XỬ LÝ LỖI: DỪNG HẲN
          console.error(`❌ Lỗi upload đơn ${sessionIndex}:`, error);
          toast.error(`Lỗi upload đơn ${sessionIndex}: ${error.message}`);

          await supabase
            .from('live_orders')
            .update({ upload_status: 'failed' })
            .eq('session_index', sessionIndex);

          setIsUploading(false);
          queryClient.invalidateQueries({ queryKey: ['upload-tpos-orders'] });
          return; // DỪNG BATCH
        }
      }

      // SUCCESS - Upload hết tất cả
      toast.success(`✅ Upload thành công ${ordersToUpload.length} đơn hàng!`);
      queryClient.invalidateQueries({ queryKey: ['upload-tpos-orders'] });
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      onUploadComplete();
      
    } catch (error) {
      console.error("❌ Lỗi upload:", error);
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const allSelected = orders.length > 0 && selectedSessionIndexes.size === orders.length;
  const someSelected = selectedSessionIndexes.size > 0 && selectedSessionIndexes.size < orders.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Upload Orders lên TPOS</DialogTitle>
        </DialogHeader>

        {isUploading && (
          <div className="py-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Đang upload đơn {uploadProgress.current}/{uploadProgress.total}...
            </p>
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có đơn hàng nào để upload (cần có Mã Order ID)
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected || someSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={isUploading}
                    />
                  </TableHead>
                  <TableHead>SessionIndex</TableHead>
                  <TableHead>Mã TPOS</TableHead>
                  <TableHead>Mã Order ID</TableHead>
                  <TableHead className="text-right">Số SP</TableHead>
                  <TableHead className="text-right">Tổng SL</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.session_index}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSessionIndexes.has(order.session_index)}
                        onCheckedChange={(checked) =>
                          handleSelectOrder(order.session_index, checked as boolean)
                        }
                        disabled={isUploading}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.session_index}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {order.tpos_order_id || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {order.code_tpos_order_id || '-'}
                    </TableCell>
                    <TableCell className="text-right">{order.product_count}</TableCell>
                    <TableCell className="text-right">{order.total_quantity}</TableCell>
                    <TableCell>
                      {order.upload_status === 'success' && (
                        <Badge variant="default" className="bg-green-600">Đã upload</Badge>
                      )}
                      {order.upload_status === 'failed' && (
                        <Badge variant="destructive">Lỗi</Badge>
                      )}
                      {!order.upload_status && (
                        <Badge variant="outline">Chưa upload</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Hủy
          </Button>
          <Button 
            onClick={handleUploadSelected} 
            disabled={selectedSessionIndexes.size === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload đã chọn ({selectedSessionIndexes.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
