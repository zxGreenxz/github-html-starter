import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";

interface LiveProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string | null;
  image_url?: string | null;
  prepared_quantity: number;
  sold_quantity: number;
}

interface ProductDetail {
  product_code: string;
  product_name: string;
  variant: string | null;
  image_url: string | null;
  prepared_quantity: number;
  sold_quantity: number;
  purchase_price: number;
  selling_price: number;
}

interface SupplierGroup {
  supplier_name: string;
  product_count: number;
  total_quantity: number;
  total_invoice: number;
  products: ProductDetail[];
}

interface LiveSupplierStatsProps {
  liveProducts: LiveProduct[];
  sessionId: string;
  phaseId: string;
}

export function LiveSupplierStats({ liveProducts }: LiveSupplierStatsProps) {
  // Query products table to get full product details
  const { data: productsData } = useQuery({
    queryKey: ["products-supplier-details", liveProducts.map(p => p.product_code)],
    queryFn: async () => {
      if (liveProducts.length === 0) return [];
      
      const productCodes = [...new Set(liveProducts.map(p => p.product_code))];
      
      const { data, error } = await supabase
        .from("products")
        .select("product_code, supplier_name, purchase_price, selling_price, product_images")
        .in("product_code", productCodes);
      
      if (error) throw error;
      return data || [];
    },
    enabled: liveProducts.length > 0,
  });

  // Group products by supplier with detailed information
  const supplierGroups: SupplierGroup[] = (() => {
    if (!productsData) return [];

    const groupsMap = new Map<string, SupplierGroup>();

    liveProducts.forEach(liveProduct => {
      const productInfo = productsData.find(p => p.product_code === liveProduct.product_code);
      const supplierName = productInfo?.supplier_name || "Chưa xác định";

      if (!groupsMap.has(supplierName)) {
        groupsMap.set(supplierName, {
          supplier_name: supplierName,
          product_count: 0,
          total_quantity: 0,
          total_invoice: 0,
          products: [],
        });
      }

      const group = groupsMap.get(supplierName)!;
      
      const productDetail: ProductDetail = {
        product_code: liveProduct.product_code,
        product_name: liveProduct.product_name,
        variant: liveProduct.variant || null,
        image_url: liveProduct.image_url || productInfo?.product_images?.[0] || null,
        prepared_quantity: liveProduct.prepared_quantity,
        sold_quantity: liveProduct.sold_quantity,
        purchase_price: productInfo?.purchase_price || 0,
        selling_price: productInfo?.selling_price || 0,
      };

      group.products.push(productDetail);
    });

    // Calculate totals for each supplier
    groupsMap.forEach(group => {
      const uniqueCodes = new Set(group.products.map(p => p.product_code));
      group.product_count = uniqueCodes.size;
      group.total_quantity = group.products.reduce((sum, p) => sum + p.prepared_quantity, 0);
      group.total_invoice = group.products.reduce((sum, p) => sum + (p.selling_price * p.prepared_quantity), 0);
      
      // Sort products by product_code
      group.products.sort((a, b) => a.product_code.localeCompare(b.product_code));
    });

    // Convert to array and sort by total_invoice (descending)
    return Array.from(groupsMap.values()).sort((a, b) => b.total_invoice - a.total_invoice);
  })();

  if (liveProducts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Store className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chưa có dữ liệu</h3>
          <p className="text-muted-foreground text-center">
            Thêm sản phẩm vào phiên live để xem thống kê theo nhà cung cấp
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Thống kê chi tiết sản phẩm theo NCC
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Nhà cung cấp</TableHead>
                <TableHead className="text-center">SL bán</TableHead>
                <TableHead>Mã sản phẩm</TableHead>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead>Biến thể</TableHead>
                <TableHead className="w-[80px]">Hình ảnh</TableHead>
                <TableHead className="text-center">SL chuẩn bị</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                supplierGroups.map((group) => (
                  <>
                    {group.products.map((product, productIndex) => (
                      <TableRow key={`${group.supplier_name}-${product.product_code}-${product.variant || 'default'}`}>
                        {productIndex === 0 && (
                          <TableCell rowSpan={group.products.length} className="align-top border-r">
                            <div className="flex flex-col gap-1">
                              <div className="font-semibold text-base">{group.supplier_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Số mã: {group.product_count}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Số lượng món: {group.total_quantity}
                              </div>
                              <div className="text-sm font-semibold text-primary mt-1">
                                {formatVND(group.total_invoice)}
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-center font-medium text-red-600">
                          {product.sold_quantity}
                        </TableCell>
                        <TableCell className="font-medium">{product.product_code}</TableCell>
                        <TableCell>{product.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.variant || "-"}
                        </TableCell>
                        <TableCell>
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.product_name}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                              N/A
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {product.prepared_quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatVND(product.selling_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
