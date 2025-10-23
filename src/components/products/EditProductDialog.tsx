import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVariantDetector } from "@/hooks/use-variant-detector";
import { VariantDetectionBadge } from "./VariantDetectionBadge";
import { VariantGeneratorDialog } from "@/components/purchase-orders/VariantGeneratorDialog";
import { Sparkles } from "lucide-react";
import { GeneratedVariant } from "@/lib/variant-generator";
import { formatVariantForDisplay } from "@/lib/variant-display-utils";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  category?: string;
  barcode?: string;
  stock_quantity: number;
  supplier_name?: string;
  base_product_code?: string | null;
}

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSuccess }: EditProductDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVariantGenerator, setShowVariantGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState("price");
  const [childProducts, setChildProducts] = useState<Product[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [formData, setFormData] = useState({
    product_name: "",
    variant: "",
    selling_price: "",
    purchase_price: "",
    unit: "",
    category: "",
    barcode: "",
    stock_quantity: "",
    supplier_name: "",
    base_product_code: "",
  });

  // Auto-detect variants from product name
  const { detectionResult, hasDetections } = useVariantDetector({
    productName: formData.product_name,
    variant: formData.variant,
    enabled: open,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        product_name: product.product_name,
        variant: product.variant || "",
        selling_price: product.selling_price.toString(),
        purchase_price: product.purchase_price.toString(),
        unit: product.unit,
        category: product.category || "",
        barcode: product.barcode || "",
        stock_quantity: product.stock_quantity.toString(),
        supplier_name: product.supplier_name || "",
        base_product_code: product.base_product_code || "",
      });
    }
  }, [product]);

  // Fetch child products when dialog opens
  useEffect(() => {
    const fetchChildProducts = async () => {
      if (!product || !open) {
        setChildProducts([]);
        return;
      }

      // Only fetch if this is a parent product (base_product_code points to itself)
      const isParent = product.base_product_code === product.product_code;
      if (!isParent) {
        setChildProducts([]);
        return;
      }

      setIsLoadingChildren(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("base_product_code", product.product_code)
          .neq("product_code", product.product_code) // Exclude parent itself
          .order("product_code", { ascending: true });

        if (error) throw error;
        setChildProducts(data || []);
      } catch (error) {
        console.error("Error fetching child products:", error);
        setChildProducts([]);
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildProducts();
  }, [product, open]);

  const handleVariantTextGenerated = (variantText: string) => {
    setFormData({ ...formData, variant: variantText });
    setShowVariantGenerator(false);
  };

  const handleVariantsRegenerated = async (data: {
    variants: GeneratedVariant[];
    variantText: string;
    attributeLines: any[];
  }) => {
    if (!product) return;

    setIsSubmitting(true);

    try {
      // STEP 1: Xóa tất cả variants cũ
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("base_product_code", product.product_code)
        .neq("product_code", product.product_code);

      if (deleteError) {
        throw deleteError;
      }

      // STEP 2: Tạo variants mới
      const newVariants = data.variants.map(v => {
        let finalProductCode = v.DefaultCode;

        // Logic đặc biệt: Nếu CHỈ có 1 attribute là "Size Số" → thêm chữ "A"
        if (data.attributeLines.length === 1 && data.attributeLines[0].attributeId === 4) {
          const baseCode = product.product_code;
          const sizeNumber = v.AttributeValues?.[0]?.Name || '';
          finalProductCode = `${baseCode}A${sizeNumber}`;
        }

        return {
          product_code: finalProductCode,
          product_name: v.Name,
          variant: v.AttributeValues?.map(av => av.Name).join(', ') || '',
          base_product_code: product.product_code,
          selling_price: parseFloat(formData.selling_price) || 0,
          purchase_price: parseFloat(formData.purchase_price) || 0,
          stock_quantity: 0,
          unit: formData.unit || 'Cái',
          category: formData.category || null,
          supplier_name: formData.supplier_name || null,
          tpos_product_id: null,
        };
      });

      const { error: insertError } = await supabase
        .from("products")
        .insert(newVariants);

      if (insertError) {
        throw insertError;
      }

      // STEP 3: Update variant string của parent product
      const { error: updateError } = await supabase
        .from("products")
        .update({ variant: data.variantText })
        .eq("id", product.id);

      if (updateError) {
        throw updateError;
      }

      // STEP 4: Update formData.variant trong React state
      setFormData(prev => ({
        ...prev,
        variant: data.variantText
      }));

      toast({
        title: "✅ Thành công",
        description: `Đã tạo lại ${newVariants.length} biến thể mới`,
      });

      setShowVariantGenerator(false);
      onSuccess(); // Refresh product list

      // Refresh child products list
      const { data: refreshedChildren } = await supabase
        .from("products")
        .select("*")
        .eq("base_product_code", product.product_code)
        .neq("product_code", product.product_code)
        .order("product_code", { ascending: true });

      if (refreshedChildren) {
        setChildProducts(refreshedChildren);
      }
    } catch (error: any) {
      console.error("Error regenerating variants:", error);
      toast({
        title: "❌ Lỗi",
        description: error.message || "Không thể tạo lại biến thể",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    // Validation không để trống
    if (!formData.base_product_code || formData.base_product_code.trim() === "") {
      toast({
        title: "Lỗi",
        description: "Base Product Code không được để trống",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const updatedSellingPrice = parseFloat(formData.selling_price) || 0;
    const updatedPurchasePrice = parseFloat(formData.purchase_price) || 0;

    const { error } = await supabase
      .from("products")
      .update({
        product_name: formData.product_name,
        variant: formData.variant || null,
        selling_price: updatedSellingPrice,
        purchase_price: updatedPurchasePrice,
        unit: formData.unit,
        category: formData.category || null,
        barcode: formData.barcode || null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        supplier_name: formData.supplier_name || null,
        base_product_code: formData.base_product_code,
      })
      .eq("id", product.id);

    if (error) {
      setIsSubmitting(false);
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Nếu đây là parent product (không có base_product_code), 
    // cập nhật giá cho variants có giá = 0
    const isParentProduct = !product.base_product_code;
    if (isParentProduct && product.product_code) {
      // Update selling_price for variants with 0 price
      await supabase
        .from("products")
        .update({ selling_price: updatedSellingPrice })
        .eq("base_product_code", product.product_code)
        .eq("selling_price", 0);
      
      // Update purchase_price for variants with 0 price
      await supabase
        .from("products")
        .update({ purchase_price: updatedPurchasePrice })
        .eq("base_product_code", product.product_code)
        .eq("purchase_price", 0);
    }

    setIsSubmitting(false);
    toast({
      title: "Thành công",
      description: "Đã cập nhật sản phẩm",
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ===== PHẦN TRÊN: Fixed Header ===== */}
          <div className="space-y-4 pb-4 border-b">
            <div>
              <Label>Mã sản phẩm</Label>
              <Input value={product?.product_code || ""} disabled className="bg-muted" />
            </div>

            <div>
              <Label htmlFor="product_name">Tên sản phẩm *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Base Product Code</Label>
              <Input
                value={formData.base_product_code}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Có thể giống với Mã sản phẩm (parent tự trỏ chính nó)
              </p>
            </div>
          </div>

          {/* ===== PHẦN DƯỚI: Tabs ===== */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="price">Giá</TabsTrigger>
              <TabsTrigger value="variants">Biến thể</TabsTrigger>
              <TabsTrigger value="general">Thông tin chung</TabsTrigger>
            </TabsList>

            {/* TAB 1: Giá */}
            <TabsContent value="price" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="selling_price">Giá bán</Label>
                <Input
                  id="selling_price"
                  type="number"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="purchase_price">Giá mua</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  placeholder="0"
                />
              </div>
            </TabsContent>

            {/* TAB 2: Biến thể */}
            <TabsContent value="variants" className="space-y-6 mt-4">
              {/* Section 1: Thuộc tính */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Thuộc tính</h3>
                <div>
                  <Label htmlFor="variant">Giá trị thuộc tính</Label>
                  <div className="flex gap-2">
                    <Input
                      id="variant"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      placeholder="(1 | 2 | 3) (S | M | L)"
                      readOnly
                      className="bg-muted"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowVariantGenerator(true)}
                      title="Tạo biến thể tự động"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                  {hasDetections && (
                    <VariantDetectionBadge detectionResult={detectionResult} className="mt-2" />
                  )}
                </div>
              </div>

              {/* Section 2: Danh sách biến thể */}
              {product?.base_product_code === product?.product_code && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Biến thể ({childProducts.length})
                  </h3>
                  
                  {isLoadingChildren ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Đang tải danh sách biến thể...
                    </div>
                  ) : childProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Chưa có biến thể nào. Nhấn nút ✨ để tạo biến thể.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">STT</TableHead>
                            <TableHead>Tên</TableHead>
                            <TableHead className="w-32 text-right">Giá</TableHead>
                            <TableHead className="w-24 text-right">Tồn kho</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {childProducts.map((child, index) => (
                            <TableRow key={child.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">[{child.product_code}] {child.product_name}</div>
                                  {child.variant && (
                                    <div className="text-xs text-muted-foreground">
                                      ({formatVariantForDisplay(child.variant)})
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {child.selling_price?.toLocaleString('vi-VN') || '0'}
                              </TableCell>
                              <TableCell className="text-right">
                                {child.stock_quantity || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: Thông tin chung */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="unit">Đơn vị</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="Cái"
                />
              </div>

              <div>
                <Label htmlFor="category">Nhóm sản phẩm</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Nhập nhóm sản phẩm"
                />
              </div>

              <div>
                <Label htmlFor="stock_quantity">Số lượng tồn</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  disabled={product?.base_product_code === product?.product_code}
                  placeholder="0"
                />
                {product?.base_product_code === product?.product_code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tồn kho parent = tổng tồn kho các biến thể
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="barcode">Mã vạch</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Nhập mã vạch"
                />
              </div>

              <div>
                <Label htmlFor="supplier_name">Nhà cung cấp</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="Nhập tên nhà cung cấp"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* ===== FOOTER: Action buttons ===== */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Cập nhật"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Variant Generator Dialog */}
      {product && (
        <VariantGeneratorDialog
          open={showVariantGenerator}
          onOpenChange={setShowVariantGenerator}
          currentItem={{
            product_code: product.product_code,
            product_name: formData.product_name,
            variant: formData.variant,
            selling_price: parseFloat(formData.selling_price) || 0,
            purchase_price: parseFloat(formData.purchase_price) || 0,
          }}
          onVariantsRegenerated={handleVariantsRegenerated}
        />
      )}
    </Dialog>
  );
}
