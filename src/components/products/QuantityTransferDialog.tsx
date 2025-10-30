import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { TPOSProductFullDetails, TPOSProductVariantDetail } from "@/lib/tpos-api";

interface QuantityTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productDetails: TPOSProductFullDetails | null;
  onSuccess?: () => void;
}

interface TransferState {
  variant1: TPOSProductVariantDetail | null;
  variant2: TPOSProductVariantDetail | null;
  initialQty1: number;
  initialQty2: number;
  currentQty1: number;
  currentQty2: number;
}

export function QuantityTransferDialog({
  open,
  onOpenChange,
  productDetails,
  onSuccess,
}: QuantityTransferDialogProps) {
  const [state, setState] = useState<TransferState>({
    variant1: null,
    variant2: null,
    initialQty1: 0,
    initialQty2: 0,
    currentQty1: 0,
    currentQty2: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state khi dialog đóng hoặc product thay đổi
  useEffect(() => {
    if (!open || !productDetails) {
      setState({
        variant1: null,
        variant2: null,
        initialQty1: 0,
        initialQty2: 0,
        currentQty1: 0,
        currentQty2: 0,
      });
    }
  }, [open, productDetails]);

  const selectVariant1 = (variantId: string) => {
    const variant = productDetails?.ProductVariants.find(
      (v) => v.Id.toString() === variantId
    );
    if (!variant) return;

    console.log("📦 [Transfer] Select Variant 1:", variant);
    setState((prev) => ({
      ...prev,
      variant1: variant,
      initialQty1: variant.QtyAvailable || 0,
      currentQty1: variant.QtyAvailable || 0,
    }));
  };

  const selectVariant2 = (variantId: string) => {
    const variant = productDetails?.ProductVariants.find(
      (v) => v.Id.toString() === variantId
    );
    if (!variant) return;

    console.log("📦 [Transfer] Select Variant 2:", variant);
    setState((prev) => ({
      ...prev,
      variant2: variant,
      initialQty2: variant.QtyAvailable || 0,
      currentQty2: variant.QtyAvailable || 0,
    }));
  };

  const adjustQuantity = (variantIndex: 1 | 2, delta: number) => {
    setState((prev) => {
      let newQty1 = prev.currentQty1;
      let newQty2 = prev.currentQty2;

      if (variantIndex === 1) {
        newQty1 = prev.currentQty1 + delta;
        newQty2 = prev.currentQty2 - delta; // Tự động giảm
      } else {
        newQty2 = prev.currentQty2 + delta;
        newQty1 = prev.currentQty1 - delta; // Tự động giảm
      }

      // Validation: Không cho < 0
      if (newQty1 < 0 || newQty2 < 0) {
        toast({
          title: "⚠️ Không thể thực hiện",
          description: "Số lượng không thể nhỏ hơn 0",
          variant: "destructive",
        });
        return prev;
      }

      console.log("📦 [Transfer] Adjust quantity:", {
        variantIndex,
        delta,
        newQty1,
        newQty2,
      });

      return {
        ...prev,
        currentQty1: newQty1,
        currentQty2: newQty2,
      };
    });
  };

  const swapVariants = () => {
    if (!state.variant1 || !state.variant2) return;

    console.log("📦 [Transfer] Swap variants");
    setState((prev) => ({
      variant1: prev.variant2,
      variant2: prev.variant1,
      initialQty1: prev.initialQty2,
      initialQty2: prev.initialQty1,
      currentQty1: prev.currentQty2,
      currentQty2: prev.currentQty1,
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!state.variant1 || !state.variant2) {
      toast({
        title: "❌ Thiếu thông tin",
        description: "Vui lòng chọn đủ 2 biến thể",
        variant: "destructive",
      });
      return;
    }

    if (state.variant1.Id === state.variant2.Id) {
      toast({
        title: "❌ Lỗi",
        description: "Hai biến thể phải khác nhau",
        variant: "destructive",
      });
      return;
    }

    const hasChanges =
      state.currentQty1 !== state.initialQty1 ||
      state.currentQty2 !== state.initialQty2;

    if (!hasChanges) {
      toast({
        title: "⚠️ Không có thay đổi",
        description: "Vui lòng thay đổi số lượng trước khi lưu",
        variant: "destructive",
      });
      return;
    }

    // Build changedQtyMap
    const changedQtyMap: Record<number, number> = {};
    if (state.currentQty1 !== state.initialQty1) {
      changedQtyMap[state.variant1.Id] = state.currentQty1;
    }
    if (state.currentQty2 !== state.initialQty2) {
      changedQtyMap[state.variant2.Id] = state.currentQty2;
    }

    // Log để verify
    console.log("📦 [Transfer] Ready to submit:", {
      productTmplId: productDetails?.Id,
      variant1: {
        id: state.variant1.Id,
        name: state.variant1.NameGet || state.variant1.Name,
        from: state.initialQty1,
        to: state.currentQty1,
        change: state.currentQty1 - state.initialQty1,
      },
      variant2: {
        id: state.variant2.Id,
        name: state.variant2.NameGet || state.variant2.Name,
        from: state.initialQty2,
        to: state.currentQty2,
        change: state.currentQty2 - state.initialQty2,
      },
      changedQtyMap,
    });

    // Call 3-step TPOS API
    setIsSubmitting(true);

    try {
      // Import service function
      const { transferQuantitiesThreeStep } = await import('@/lib/tpos-quantity-transfer');

      // Call 3-step process
      await transferQuantitiesThreeStep(productDetails!.Id, changedQtyMap);

      // Success
      toast({
        title: "✅ Thành công",
        description: "Đã chuyển đổi số lượng thành công!",
      });

      // Close dialog và callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('❌ [Transfer] Upload error:', error);
      toast({
        title: "❌ Lỗi",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    state.currentQty1 !== state.initialQty1 ||
    state.currentQty2 !== state.initialQty2;

  const isSubmitDisabled =
    !state.variant1 ||
    !state.variant2 ||
    state.variant1.Id === state.variant2.Id ||
    !hasChanges;

  // Filter variants cho dropdown
  const availableVariantsFor1 = productDetails?.ProductVariants.filter(
    (v) => v.Id !== state.variant2?.Id
  );
  const availableVariantsFor2 = productDetails?.ProductVariants.filter(
    (v) => v.Id !== state.variant1?.Id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Đổi Size - Chuyển đổi số lượng</DialogTitle>
          <DialogDescription>
            Chuyển đổi số lượng giữa hai biến thể của cùng một sản phẩm
          </DialogDescription>
        </DialogHeader>

        {/* PRODUCT INFO HEADER */}
        {productDetails && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-start gap-4">
              {/* Ảnh sản phẩm */}
              {productDetails.ImageUrl && (
                <img
                  src={productDetails.ImageUrl}
                  alt={productDetails.Name}
                  className="w-20 h-20 object-cover rounded border"
                />
              )}
              
              {/* Thông tin sản phẩm */}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {productDetails.NameGet || productDetails.Name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Mã: {productDetails.DefaultCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tổng số biến thể: {productDetails.ProductVariants?.length || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instruction Box */}
        <div className="text-sm text-muted-foreground mb-4 bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
          💡 <strong>Hướng dẫn:</strong> Chọn hai biến thể để chuyển đổi số
          lượng giữa chúng. Khi tăng số lượng của một biến thể, biến thể kia sẽ{" "}
          <strong>tự động giảm</strong> tương ứng (không thể giảm xuống dưới
          0).
        </div>

        {/* Main Grid: 3 columns */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
          {/* Slot 1: Biến thể 1 */}
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <h3 className="font-semibold text-center text-primary">
              Biến thể 1
            </h3>

            <div>
              <Label>Chọn biến thể:</Label>
              <Select
                value={state.variant1?.Id.toString()}
                onValueChange={selectVariant1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn biến thể --" />
                </SelectTrigger>
                <SelectContent>
                  {availableVariantsFor1?.map((variant) => (
                    <SelectItem
                      key={variant.Id}
                      value={variant.Id.toString()}
                    >
                      {variant.NameGet || variant.Name} ({variant.DefaultCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.variant1 && (
              <>
                <div className="text-center space-y-2">
                  <Label className="block font-semibold">
                    Số lượng hiện tại:
                  </Label>
                  <div className="text-4xl font-bold text-primary">
                    {state.currentQty1}
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(1, -1)}
                    disabled={state.currentQty1 <= 0}
                    title="Giảm số lượng"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(1, 1)}
                    disabled={state.currentQty2 <= 0}
                    title="Tăng số lượng"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Swap Button (center) */}
          <div className="flex items-center justify-center h-full pt-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={swapVariants}
              disabled={!state.variant1 || !state.variant2}
              className="h-10 w-10"
              title="Đổi chỗ 2 biến thể"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Slot 2: Biến thể 2 */}
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <h3 className="font-semibold text-center text-primary">
              Biến thể 2
            </h3>

            <div>
              <Label>Chọn biến thể:</Label>
              <Select
                value={state.variant2?.Id.toString()}
                onValueChange={selectVariant2}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn biến thể --" />
                </SelectTrigger>
                <SelectContent>
                  {availableVariantsFor2?.map((variant) => (
                    <SelectItem
                      key={variant.Id}
                      value={variant.Id.toString()}
                    >
                      {variant.NameGet || variant.Name} ({variant.DefaultCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.variant2 && (
              <>
                <div className="text-center space-y-2">
                  <Label className="block font-semibold">
                    Số lượng hiện tại:
                  </Label>
                  <div className="text-4xl font-bold text-primary">
                    {state.currentQty2}
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(2, -1)}
                    disabled={state.currentQty2 <= 0}
                    title="Giảm số lượng"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(2, 1)}
                    disabled={state.currentQty1 <= 0}
                    title="Tăng số lượng"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>💾 Lưu chuyển đổi số lượng</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
