import { useState } from "react";
import { Search, Package, Loader2, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";
import { queryWithAutoRefresh } from "@/lib/query-with-auto-refresh";

export function TPOSVariantLookup() {
  // Tab Biến thể
  const [variantCode, setVariantCode] = useState("");
  const [isLoadingVariant, setIsLoadingVariant] = useState(false);
  const [variantData, setVariantData] = useState<any>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Tab Sản phẩm
  const [productCode, setProductCode] = useState("");
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const { toast } = useToast();

  const formatNumber = (num: number | undefined | null): string => {
    if (num == null) return "0";
    return num.toLocaleString("vi-VN");
  };

  const loadVariantData = async () => {
    if (!variantCode.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập mã biến thể",
      });
      return;
    }

    setIsLoadingVariant(true);
    setVariantData(null);
    setVariantError(null);

    try {
      // STEP 1: Search API - Tìm ID TPOS từ mã biến thể
      const searchUrl = `https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(variantCode)}`;
      
      const searchData = await queryWithAutoRefresh(async () => {
        const token = await getActiveTPOSToken();
        if (!token) {
          throw new Error("Không tìm thấy TPOS bearer token");
        }
        
        const headers = getTPOSHeaders(token);
        const response = await fetch(searchUrl, { method: "GET", headers });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      }, "tpos");

      if (!searchData.value || searchData.value.length === 0) {
        throw new Error(`Không tìm thấy biến thể với mã "${variantCode}"`);
      }

      // ✅ Filter để tìm DefaultCode khớp chính xác (case-insensitive)
      const exactMatch = searchData.value.find(
        (item: any) => item.DefaultCode?.toUpperCase() === variantCode.toUpperCase()
      );

      if (!exactMatch) {
        throw new Error(
          `Không tìm thấy biến thể với mã chính xác "${variantCode}". ` +
          `Tìm thấy các mã tương tự: ${searchData.value.map((v: any) => v.DefaultCode).join(', ')}`
        );
      }

      const variantId = exactMatch.Id;

      // STEP 2: Detail API - Lấy thông tin chi tiết từ ID TPOS
      const detailUrl = `https://tomato.tpos.vn/odata/Product(${variantId})?$expand=UOM,Categ,UOMPO,POSCateg,AttributeValues`;
      
      const data = await queryWithAutoRefresh(async () => {
        const token = await getActiveTPOSToken();
        if (!token) {
          throw new Error("Không tìm thấy TPOS bearer token");
        }

        const headers = getTPOSHeaders(token);
        const response = await fetch(detailUrl, { method: "GET", headers });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      }, "tpos");

      setVariantData(data);
      toast({
        title: "Thành công",
        description: `Đã lấy thông tin biến thể "${data.NameGet}"`,
      });
    } catch (error: any) {
      setVariantError(error.message);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setIsLoadingVariant(false);
    }
  };

  const loadProductData = async () => {
    if (!productCode.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập mã sản phẩm",
      });
      return;
    }

    setIsLoadingProduct(true);
    setProductData(null);
    setProductError(null);

    try {
      // STEP 1: Search API - Tìm ID TPOS từ mã sản phẩm
      const searchUrl = `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${encodeURIComponent(productCode)}`;
      
      const searchData = await queryWithAutoRefresh(async () => {
        const token = await getActiveTPOSToken();
        if (!token) {
          throw new Error("Không tìm thấy TPOS bearer token");
        }
        
        const headers = getTPOSHeaders(token);
        const response = await fetch(searchUrl, { method: "GET", headers });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      }, "tpos");

      if (!searchData.value || searchData.value.length === 0) {
        throw new Error(`Không tìm thấy sản phẩm với mã "${productCode}"`);
      }

      // ✅ Filter để tìm DefaultCode khớp chính xác (case-insensitive)
      const exactMatch = searchData.value.find(
        (item: any) => item.DefaultCode?.toUpperCase() === productCode.toUpperCase()
      );

      if (!exactMatch) {
        throw new Error(
          `Không tìm thấy sản phẩm với mã chính xác "${productCode}". ` +
          `Tìm thấy các mã tương tự: ${searchData.value.map((v: any) => v.DefaultCode).join(', ')}`
        );
      }

      const productId = exactMatch.Id;

      // STEP 2: Detail API - Lấy thông tin chi tiết từ ID TPOS
      const detailUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${productId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
      
      const data = await queryWithAutoRefresh(async () => {
        const token = await getActiveTPOSToken();
        if (!token) {
          throw new Error("Không tìm thấy TPOS bearer token");
        }

        const headers = getTPOSHeaders(token);
        const response = await fetch(detailUrl, { method: "GET", headers });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      }, "tpos");

      setProductData(data);
      toast({
        title: "Thành công",
        description: `Đã lấy thông tin sản phẩm "${data.NameGet}" (${data.ProductVariantCount || 0} biến thể)`,
      });
    } catch (error: any) {
      setProductError(error.message);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          TPOS Variant & Product Lookup
        </CardTitle>
        <CardDescription>Tra cứu thông tin biến thể và sản phẩm từ TPOS</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="variant">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="variant" className="gap-2">
              🎨 Biến thể
            </TabsTrigger>
            <TabsTrigger value="product" className="gap-2">
              <Package className="h-4 w-4" />
              Sản phẩm
            </TabsTrigger>
          </TabsList>

          {/* Tab Biến thể */}
          <TabsContent value="variant" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nhập mã biến thể (VD: NTESTD1)"
                value={variantCode}
                onChange={(e) => setVariantCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && loadVariantData()}
                disabled={isLoadingVariant}
              />
              <Button onClick={loadVariantData} disabled={isLoadingVariant}>
                {isLoadingVariant ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Lấy sản phẩm
                  </>
                )}
              </Button>
            </div>

            {variantError && (
              <Alert variant="destructive">
                <AlertDescription>{variantError}</AlertDescription>
              </Alert>
            )}

            {variantData && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Thông tin biến thể</h3>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(variantData)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy JSON
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">ID TPOS Biến thể</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{variantData.Id}</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Mã sản phẩm</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">{variantData.DefaultCode || "-"}</code>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">ID TPOS Sản phẩm</TableCell>
                        <TableCell>
                          <Badge variant="outline">{variantData.ProductTmplId}</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Tên sản phẩm</TableCell>
                        <TableCell className="font-semibold">{variantData.NameGet}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Giá bán</TableCell>
                        <TableCell className="text-green-600 font-semibold">
                          {formatNumber(variantData.PriceVariant)} đ
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Giá mua</TableCell>
                        <TableCell className="text-orange-600 font-semibold">
                          {formatNumber(variantData.StandardPrice)} đ
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Đơn vị tính</TableCell>
                        <TableCell>{variantData.UOM?.Name || "-"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Danh mục</TableCell>
                        <TableCell>{variantData.Categ?.Name || "-"}</TableCell>
                      </TableRow>
                      {variantData.AttributeValues && variantData.AttributeValues.length > 0 && (
                        <TableRow>
                          <TableCell className="font-medium">Thuộc tính</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {variantData.AttributeValues.map((attr: any, idx: number) => (
                                <Badge key={idx} variant="secondary">
                                  {attr.Name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab Sản phẩm */}
          <TabsContent value="product" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nhập mã sản phẩm (VD: NTEST)"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && loadProductData()}
                disabled={isLoadingProduct}
              />
              <Button onClick={loadProductData} disabled={isLoadingProduct}>
                {isLoadingProduct ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Lấy sản phẩm
                  </>
                )}
              </Button>
            </div>

            {productError && (
              <Alert variant="destructive">
                <AlertDescription>{productError}</AlertDescription>
              </Alert>
            )}

            {productData && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Thông tin sản phẩm gốc</h3>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(productData)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy JSON
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">ID TPOS Sản phẩm</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{productData.Id}</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Mã sản phẩm</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">{productData.DefaultCode || "-"}</code>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Tên sản phẩm</TableCell>
                        <TableCell className="font-semibold">{productData.NameGet}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Giá bán</TableCell>
                        <TableCell className="text-green-600 font-semibold">
                          {formatNumber(productData.ListPrice)} đ
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Giá mua</TableCell>
                        <TableCell className="text-orange-600 font-semibold">
                          {formatNumber(productData.PurchasePrice)} đ
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Số lượng biến thể</TableCell>
                        <TableCell>
                          <Badge>{productData.ProductVariantCount || 0}</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Đơn vị tính</TableCell>
                        <TableCell>{productData.UOM?.Name || "-"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Danh mục</TableCell>
                        <TableCell>{productData.Categ?.Name || "-"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Danh sách biến thể */}
                {productData.ProductVariants && productData.ProductVariants.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Danh sách Biến thể ({productData.ProductVariants.length})</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Mã SP</TableHead>
                            <TableHead>ID Sản phẩm</TableHead>
                            <TableHead>Tên sản phẩm</TableHead>
                            <TableHead className="text-right">Giá bán biến thể</TableHead>
                            <TableHead className="text-right">Giá bán SP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productData.ProductVariants.map((variant: any) => (
                            <TableRow key={variant.Id}>
                              <TableCell>
                                <Badge variant="secondary">{variant.Id}</Badge>
                              </TableCell>
                              <TableCell>
                                <code className="bg-muted px-2 py-1 rounded text-xs">{variant.DefaultCode || "-"}</code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{variant.ProductTmplId}</Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{variant.NameGet}</TableCell>
                              <TableCell className="text-right text-green-600 font-medium">
                                {formatNumber(variant.PriceVariant)} đ
                              </TableCell>
                              <TableCell className="text-right text-orange-600">
                                {formatNumber(variant.ListPrice)} đ
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
