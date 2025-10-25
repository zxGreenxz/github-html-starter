import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateAttributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  existingNames: string[];
}

export function CreateAttributeDialog({
  open,
  onOpenChange,
  onSubmit,
  existingNames,
}: CreateAttributeDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên thuộc tính");
      return;
    }

    if (existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
      setError("Tên thuộc tính đã tồn tại");
      return;
    }

    onSubmit(trimmedName);
    setName("");
    setError("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm thuộc tính mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attribute-name">Tên thuộc tính</Label>
            <Input
              id="attribute-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Ví dụ: Màu, Size, Chất liệu..."
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit">Tạo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
