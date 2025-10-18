import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProductCodesPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCodes: string[];
  commentMessage: string;
  onConfirm: (codes: string[]) => void;
  commentType: "hang_dat" | "hang_le";
}

export function ProductCodesPreviewDialog({
  open,
  onOpenChange,
  initialCodes,
  commentMessage,
  onConfirm,
  commentType,
}: ProductCodesPreviewDialogProps) {
  const [productCodes, setProductCodes] = useState<string[]>(initialCodes);
  const [newCode, setNewCode] = useState("");

  // ✅ Sync productCodes state when initialCodes changes
  useEffect(() => {
    console.log('🔄 [PREVIEW DIALOG] initialCodes changed:', initialCodes);
    setProductCodes(initialCodes);
  }, [initialCodes]);

  // ✅ Reset newCode input when dialog closes
  useEffect(() => {
    if (!open) {
      setNewCode("");
      console.log('🔒 [PREVIEW DIALOG] Dialog closed, reset newCode');
    }
  }, [open]);

  const handleAddCode = () => {
    const trimmed = newCode.trim().toUpperCase();
    if (trimmed && !productCodes.includes(trimmed)) {
      console.log('➕ [PREVIEW DIALOG] Adding code:', trimmed);
      setProductCodes([...productCodes, trimmed]);
      setNewCode("");
    }
  };

  const handleRemoveCode = (code: string) => {
    console.log('➖ [PREVIEW DIALOG] Removing code:', code);
    setProductCodes(productCodes.filter(c => c !== code));
  };

  const handleConfirm = () => {
    console.log('✅ [PREVIEW DIALOG] Confirm clicked with codes:', productCodes);
    onConfirm(productCodes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Xác nhận mã sản phẩm</DialogTitle>
          <DialogDescription>
            Kiểm tra và chỉnh sửa danh sách mã sản phẩm trước khi tạo đơn hàng
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Comment message preview */}
          <div>
            <Label className="text-xs text-muted-foreground">Nội dung comment:</Label>
            <p className="text-sm bg-muted p-2 rounded mt-1 line-clamp-3">
              {commentMessage}
            </p>
          </div>

          {/* Product codes list */}
          <div>
            <Label className="text-xs text-muted-foreground">
              Mã sản phẩm đã phát hiện ({productCodes.length}):
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {productCodes.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Không phát hiện mã sản phẩm nào. Vui lòng thêm thủ công.
                  </AlertDescription>
                </Alert>
              ) : (
                productCodes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="text-sm px-2 py-1 gap-1"
                  >
                    {code}
                    <button
                      onClick={() => handleRemoveCode(code)}
                      className="ml-1 hover:text-destructive"
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Add new code */}
          <div className="flex gap-2">
            <Input
              placeholder="Thêm mã sản phẩm (vd: N123)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCode();
                }
              }}
              className="text-sm"
            />
            <Button
              onClick={handleAddCode}
              size="sm"
              variant="outline"
              disabled={!newCode.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Comment type badge */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Loại đơn hàng:</Label>
            <Badge variant={commentType === "hang_dat" ? "default" : "secondary"}>
              {commentType === "hang_dat" ? "Hàng đặt" : "Hàng lẻ"}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={productCodes.length === 0}
          >
            Xác nhận tạo đơn ({productCodes.length} sản phẩm)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
