import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UnifiedImageUpload } from "@/components/ui/unified-image-upload";

interface PurchaseOrderItem {
  id?: string;
  quantity: number;
  position?: number;
  notes?: string | null;
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
  tpos_product_id?: number | null;
}

interface EditPurchaseOrderItemDialogProps {
  item: PurchaseOrderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseOrderItemDialog({
  item,
  open,
  onOpenChange,
}: EditPurchaseOrderItemDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [notes, setNotes] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [priceImages, setPriceImages] = useState<string[]>([]);

  // Load item data when dialog opens
  useEffect(() => {
    if (open && item) {
      setProductCode(item.product_code || "");
      setProductName(item.product_name || "");
      setVariant(item.variant || "");
      setQuantity(item.quantity || 1);
      setPurchasePrice(item.purchase_price || 0);
      setSellingPrice(item.selling_price || 0);
      setNotes(item.notes || "");
      setProductImages(item.product_images || []);
      setPriceImages(item.price_images || []);
    }
  }, [open, item]);

  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id) throw new Error("No item ID");

      const { error } = await supabase
        .from("purchase_order_items")
        .update({
          product_code: productCode,
          product_name: productName,
          variant: variant || null,
          quantity: quantity,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          notes: notes || null,
          product_images: productImages,
          price_images: priceImages,
        })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: "Thành công",
        description: "Sản phẩm đã được cập nhật",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật sản phẩm",
        variant: "destructive",
      });
      console.error("Error updating item:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateItemMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_code">Mã sản phẩm *</Label>
              <Input
                id="product_code"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Số lượng *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_name">Tên sản phẩm *</Label>
            <Input
              id="product_name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant">Biến thể</Label>
            <Input
              id="variant"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="Ví dụ: Màu đỏ, Size M"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Giá mua *</Label>
              <Input
                id="purchase_price"
                type="number"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_price">Giá bán *</Label>
              <Input
                id="selling_price"
                type="number"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hình sản phẩm</Label>
            <div className="space-y-2">
              <UnifiedImageUpload
                value={productImages}
                onChange={(urls) => setProductImages(Array.isArray(urls) ? urls : [])}
                bucket="purchase-images"
                folder="products"
                maxFiles={5}
                showPreview
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hình giá mua</Label>
            <div className="space-y-2">
              <UnifiedImageUpload
                value={priceImages}
                onChange={(urls) => setPriceImages(Array.isArray(urls) ? urls : [])}
                bucket="purchase-images"
                folder="prices"
                maxFiles={5}
                showPreview
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú về sản phẩm..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={updateItemMutation.isPending}>
              {updateItemMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
