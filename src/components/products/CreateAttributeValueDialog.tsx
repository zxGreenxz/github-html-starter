import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateAttributeValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
  attributeName: string;
  existingValues: string[];
}

export function CreateAttributeValueDialog({
  open,
  onOpenChange,
  onSubmit,
  attributeName,
  existingValues,
}: CreateAttributeValueDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError("Vui lòng nhập giá trị");
      return;
    }

    if (existingValues.some(v => v.toLowerCase() === trimmedValue.toLowerCase())) {
      setError("Giá trị đã tồn tại");
      return;
    }

    onSubmit(trimmedValue);
    setValue("");
    setError("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setValue("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm giá trị cho "{attributeName}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">Giá trị</Label>
            <Input
              id="value"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              placeholder={`Ví dụ: ${attributeName === "Màu" ? "Xanh lá" : attributeName === "Size Số" ? "43" : "3XL"}`}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit">Thêm</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
