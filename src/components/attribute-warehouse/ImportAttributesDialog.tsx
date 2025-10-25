import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileJson } from "lucide-react";
import { useProductAttributes } from "@/hooks/use-product-attributes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ImportAttributesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
  PriceExtra: number | null;
  NameGet: string;
  DateCreated: string | null;
}

export function ImportAttributesDialog({ open, onOpenChange }: ImportAttributesDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { attributes } = useProductAttributes();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/json") {
      setSelectedFile(file);
    } else {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file JSON",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file JSON",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await selectedFile.text();
      const jsonData = JSON.parse(text);
      
      if (!jsonData.value || !Array.isArray(jsonData.value)) {
        throw new Error("Format JSON không hợp lệ. Cần có trường 'value' là array.");
      }

      const values: TPOSAttributeValue[] = jsonData.value;
      let importedCount = 0;
      let createdAttributesCount = 0;

      for (const item of values) {
        // 1. Tạo hoặc lấy attribute_id
        let attribute = attributes.find(a => a.name === item.AttributeName);
        
        if (!attribute) {
          const { data: newAttribute, error: attrError } = await supabase
            .from("product_attributes")
            .insert({ 
              name: item.AttributeName,
              display_order: 0 
            })
            .select()
            .single();
          
          if (attrError) throw attrError;
          attribute = newAttribute;
          createdAttributesCount++;
        }
        
        // 2. Kiểm tra xem giá trị đã tồn tại chưa
        const { data: existingValue } = await supabase
          .from("product_attribute_values")
          .select("id")
          .eq("attribute_id", attribute.id)
          .eq("value", item.Name)
          .maybeSingle();

        if (existingValue) {
          // Skip nếu đã tồn tại
          continue;
        }

        // 3. Insert attribute value với đầy đủ các trường
        const { error: valueError } = await supabase
          .from("product_attribute_values")
          .insert({
            value: item.Name,
            code: item.Code || null,
            attribute_id: attribute.id,
            price_extra: item.PriceExtra || 0,
            name_get: item.NameGet || `${item.AttributeName}: ${item.Name}`,
            display_order: item.Sequence || 0,
            created_at: item.DateCreated || new Date().toISOString(),
            is_active: true,
          });
        
        if (valueError) throw valueError;
        importedCount++;
      }

      toast({ 
        title: "✅ Import thành công",
        description: `Đã thêm ${importedCount} giá trị${createdAttributesCount > 0 ? ` và ${createdAttributesCount} thuộc tính mới` : ''}`,
      });
      
      // Refresh data
      window.location.reload();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Lỗi import",
        description: error.message || "Có lỗi xảy ra khi import dữ liệu",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import dữ liệu từ TPOS</DialogTitle>
          <DialogDescription>
            Chọn file JSON từ TPOS để import thuộc tính và giá trị
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              id="json-file-input"
            />
            <label 
              htmlFor="json-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileJson className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : "Click để chọn file JSON"}
              </p>
              <p className="text-xs text-muted-foreground">
                Hỗ trợ file JSON từ TPOS
              </p>
            </label>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Format JSON mong đợi:</p>
            <pre className="text-xs overflow-auto">
{`{
  "value": [
    {
      "Id": 18,
      "Name": "29",
      "Code": "29",
      "AttributeName": "Size Số",
      "PriceExtra": 0,
      "NameGet": "Size Số: 29"
    }
  ]
}`}
            </pre>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!selectedFile || isImporting}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? "Đang import..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
