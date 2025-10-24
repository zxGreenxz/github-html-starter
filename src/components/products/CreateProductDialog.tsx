import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateProductCode } from "@/lib/product-code-generator";
import { useVariantDetector } from "@/hooks/use-variant-detector";
import { VariantDetectionBadge } from "./VariantDetectionBadge";
import { VariantGeneratorDialog } from "@/components/purchase-orders/VariantGeneratorDialog";
import { Sparkles } from "lucide-react";
import { detectVariantsFromText } from "@/lib/variant-detector";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateProductDialog({ open, onOpenChange, onSuccess }: CreateProductDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVariantGenerator, setShowVariantGenerator] = useState(false);
  const [formData, setFormData] = useState({
    product_code: "",
    product_name: "",
    variant: "",
    selling_price: "",
    purchase_price: "",
    unit: "Cái",
    category: "",
    barcode: "",
    stock_quantity: "0",
    supplier_name: "",
  });

  // Auto-detect variants from product name
  const { detectionResult, hasDetections } = useVariantDetector({
    productName: formData.product_name,
    variant: formData.variant,
    enabled: open,
  });

  const handleVariantTextGenerated = (variantText: string) => {
    setFormData({ ...formData, variant: variantText });
    setShowVariantGenerator(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Use product code and name as-is
    // Variants are handled by the VariantGeneratorDialog when needed
    const finalProductCode = formData.product_code;
    const finalProductName = formData.variant.trim() 
      ? `${formData.product_name} (${formData.variant})` 
      : formData.product_name;

    // Validation - Không cho tạo parent trùng
    const { data: existingParent } = await supabase
      .from('products')
      .select('product_code, base_product_code')
      .eq('base_product_code', finalProductCode)
      .maybeSingle();

    if (existingParent) {
      setIsSubmitting(false);
      toast({
        title: "Lỗi",
        description: `Đã tồn tại sản phẩm cha với Base Product Code = ${finalProductCode}`,
        variant: "destructive",
      });
      return;
    }

    let finalSellingPrice = parseFloat(formData.selling_price) || 0;
    let finalPurchasePrice = parseFloat(formData.purchase_price) || 0;

    // Nếu variant không có giá và có base_product_code, lấy giá từ parent
    if ((finalSellingPrice === 0 || finalPurchasePrice === 0) && finalProductCode) {
      const { data: parentProduct } = await supabase
        .from('products')
        .select('selling_price, purchase_price')
        .eq('product_code', finalProductCode)
        .maybeSingle();
      
      if (parentProduct) {
        if (finalSellingPrice === 0) finalSellingPrice = parentProduct.selling_price;
        if (finalPurchasePrice === 0) finalPurchasePrice = parentProduct.purchase_price;
      }
    }

    const { error } = await supabase.from("products").insert({
      product_code: finalProductCode,
      base_product_code: finalProductCode,
      product_name: finalProductName,
      variant: formData.variant || null,
      selling_price: finalSellingPrice,
      purchase_price: finalPurchasePrice,
      unit: formData.unit,
      category: formData.category || null,
      barcode: formData.barcode || null,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      supplier_name: formData.supplier_name || null,
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Thành công",
        description: "Đã thêm sản phẩm mới",
      });
      onSuccess();
      onOpenChange(false);
      setFormData({
        product_code: "",
        product_name: "",
        variant: "",
        selling_price: "",
        purchase_price: "",
        unit: "Cái",
        category: "",
        barcode: "",
        stock_quantity: "0",
        supplier_name: "",
      });
    }
  };

  const handleProductNameBlur = async () => {
    if (!formData.product_name.trim() || formData.product_code.trim()) {
      return; // Skip if name is empty or code already exists
    }

    try {
      const code = await generateProductCode(formData.product_name);
      setFormData({ ...formData, product_code: code });
      toast({
        title: "Đã tạo mã sản phẩm",
        description: `Mã SP: ${code}`,
      });
    } catch (error) {
      console.error("Error generating product code:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product_code">Mã sản phẩm *</Label>
              <Input
                id="product_code"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base Product Code sẽ tự động giống Mã sản phẩm
              </p>
            </div>
            <div>
              <Label htmlFor="barcode">Mã vạch</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="product_name">Tên sản phẩm *</Label>
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              onBlur={handleProductNameBlur}
              required
            />
            {hasDetections && (
              <VariantDetectionBadge detectionResult={detectionResult} className="mt-2" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant">Variant</Label>
              <div className="flex gap-2">
                <Input
                  id="variant"
                  value={formData.variant}
                  onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                  placeholder="(1 | 2 | 3) (S | M | L)"
                  readOnly
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
            </div>
            <div>
              <Label htmlFor="unit">Đơn vị</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="selling_price">Giá bán</Label>
              <Input
                id="selling_price"
                type="number"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="purchase_price">Giá mua</Label>
              <Input
                id="purchase_price"
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Nhóm sản phẩm</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="stock_quantity">Số lượng tồn</Label>
              <Input
                id="stock_quantity"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="supplier_name">Nhà cung cấp</Label>
            <Input
              id="supplier_name"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Thêm sản phẩm"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <VariantGeneratorDialog
        open={showVariantGenerator}
        onOpenChange={setShowVariantGenerator}
        currentItem={{
          product_code: formData.product_code,
          product_name: formData.product_name,
          variant: formData.variant,
        }}
        onVariantTextGenerated={handleVariantTextGenerated}
      />
    </Dialog>
  );
}
