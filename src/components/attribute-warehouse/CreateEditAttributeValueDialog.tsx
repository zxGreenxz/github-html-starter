import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductAttributes, type ProductAttributeValue } from "@/hooks/use-product-attributes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateEditAttributeValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingValue: (ProductAttributeValue & { attributeName?: string }) | null;
}

export function CreateEditAttributeValueDialog({
  open,
  onOpenChange,
  editingValue,
}: CreateEditAttributeValueDialogProps) {
  const { attributes, createAttributeValue, updateAttributeValue } = useProductAttributes();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    attribute_id: "",
    value: "",
    code: "",
    price_extra: 0,
  });
  const [error, setError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (editingValue) {
      setFormData({
        attribute_id: editingValue.attribute_id,
        value: editingValue.value,
        code: editingValue.code || "",
        price_extra: editingValue.price_extra || 0,
      });
    } else {
      setFormData({
        attribute_id: "",
        value: "",
        code: "",
        price_extra: 0,
      });
    }
    setError("");
  }, [editingValue, open]);

  const selectedAttribute = attributes.find(a => a.id === formData.attribute_id);
  const autoNameGet = formData.value && selectedAttribute
    ? `${selectedAttribute.name}: ${formData.value}`
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.attribute_id) {
      setError("Vui lòng chọn thuộc tính");
      return;
    }

    if (!formData.value.trim()) {
      setError("Vui lòng nhập giá trị");
      return;
    }

    try {
      setIsSyncing(true);
      
      if (editingValue) {
        await updateAttributeValue.mutateAsync({
          id: editingValue.id,
          value: formData.value.trim(),
          code: formData.code.trim() || null,
          price_extra: formData.price_extra || 0,
          name_get: autoNameGet,
        });
        toast({
          title: "Đã cập nhật",
          description: `Giá trị "${formData.value}" đã được cập nhật`,
        });
      } else {
        // NEW FLOW: Sync to TPOS FIRST, only save to DB if TPOS succeeds
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'sync-attribute-value-to-tpos',
          {
            body: {
              attributeName: selectedAttribute?.name,
              code: formData.code.trim() || formData.value.trim(),
              value: formData.value.trim(),
            },
          }
        );

        if (syncError || !syncResult?.success) {
          throw new Error(syncError?.message || syncResult?.error || 'Không thể thêm vào TPOS. Vui lòng thử lại.');
        }

        // Only save to database if TPOS sync succeeded
        await createAttributeValue.mutateAsync({
          attributeId: formData.attribute_id,
          value: formData.value.trim(),
          code: formData.code.trim() || null,
          price_extra: formData.price_extra || 0,
          name_get: autoNameGet,
        });

        toast({
          title: "✅ Đã thêm thành công",
          description: `Giá trị "${formData.value}" đã được thêm vào ${selectedAttribute?.name} và đồng bộ lên TPOS`,
        });
      }
      
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingValue ? "Chỉnh sửa giá trị" : "Thêm giá trị mới"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attribute">Thuộc tính *</Label>
            <Select
              value={formData.attribute_id}
              onValueChange={(value) => setFormData({ ...formData, attribute_id: value })}
              disabled={!!editingValue}
            >
              <SelectTrigger id="attribute">
                <SelectValue placeholder="Chọn thuộc tính" />
              </SelectTrigger>
              <SelectContent>
                {attributes.map(attr => (
                  <SelectItem key={attr.id} value={attr.id}>
                    {attr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Giá trị *</Label>
            <Input
              id="value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="Ví dụ: 29, Đen, S"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Mã (Code)</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Ví dụ: 29, BLACK, S"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_extra">Phụ thu (₫)</Label>
            <Input
              id="price_extra"
              type="number"
              value={formData.price_extra}
              onChange={(e) => setFormData({ ...formData, price_extra: Number(e.target.value) })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name_get">Tên đầy đủ (tự động)</Label>
            <Input
              id="name_get"
              value={autoNameGet}
              disabled
              className="bg-muted"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSyncing}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đồng bộ TPOS...
                </>
              ) : (
                editingValue ? "Cập nhật" : "Thêm"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
