import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportProductsDialog({ open, onOpenChange, onSuccess }: ImportProductsDialogProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const parsePrice = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      // Xóa khoảng trắng
      let cleaned = value.trim().replace(/\s/g, "");
      
      // Nếu có dấu chấm hoặc phẩy ở 3 ký tự cuối → dấu thập phân
      // VD: 123,45 hoặc 123.45 → giữ lại dấu cuối
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      
      if (lastComma > -1 && lastComma > cleaned.length - 4) {
        // Dấu phẩy ở cuối (1-3 số sau dấu) → dấu thập phân
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > -1 && lastDot > cleaned.length - 4) {
        // Dấu chấm ở cuối (1-3 số sau dấu) → dấu thập phân
        cleaned = cleaned.replace(/,/g, '');
      } else {
        // Không có dấu ở cuối hoặc có > 3 số sau dấu → dấu phân cách hàng nghìn
        cleaned = cleaned.replace(/[,.]/g, '');
      }
      
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  const cleanProductName = (productName: string, productCode: string): string => {
    // Xóa [mã sản phẩm] ở đầu tên nếu có
    // VD: "[LSET690X1] 1509 A10 SET ÁO" → "1509 A10 SET ÁO"
    const pattern = new RegExp(`^\\[${productCode}\\]\\s*`, 'i');
    return productName.replace(pattern, '').trim();
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Mã sản phẩm": "SP001",
        "Tên sản phẩm": "Sản phẩm mẫu",
        "Giá bán": 100000,
        "Giá mua": 80000,
        "Đơn vị": "Cái",
        "Nhóm sản phẩm": "Nhóm A",
        "Mã vạch": "1234567890",
        "Số lượng tồn": 10
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "template_import_products.xlsx");
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file Excel",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Get existing product codes
      const { data: existingProducts } = await supabase
        .from("products")
        .select("product_code, id")
        .range(0, 9999);

      const existingCodes = new Set(existingProducts?.map((p) => p.product_code) || []);

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];

        const productCode = row["Mã sản phẩm"]?.toString().trim();
        
        if (!productCode) {
          skippedCount++;
          continue;
        }

        const isExisting = existingCodes.has(productCode);

        const rawProductName = row["Tên sản phẩm"]?.toString().trim() || "Chưa có tên";
        const cleanedProductName = cleanProductName(rawProductName, productCode);

        const productData = {
          product_code: productCode,
          product_name: cleanedProductName,
          selling_price: parsePrice(row["Giá bán"]),
          purchase_price: parsePrice(row["Giá mua"]),
          unit: row["Đơn vị"]?.toString().trim() || "Cái",
          category: row["Nhóm sản phẩm"]?.toString().trim() || null,
          barcode: row["Mã vạch"]?.toString().trim() || null,
          stock_quantity: parseInt(row["Số lượng tồn"]?.toString() || "0") || 0,
          tpos_product_id: row["Id"] ? parseInt(row["Id"]?.toString()) : null,
        };

        // UPSERT: Tự động insert nếu mới, update nếu đã tồn tại
        const { error } = await supabase
          .from("products")
          .upsert(productData, { 
            onConflict: 'product_code',
            ignoreDuplicates: false // Bắt buộc cập nhật nếu trùng
          });

        if (!error) {
          if (isExisting) {
            updatedCount++;
          } else {
            insertedCount++;
          }
        } else {
          console.error(`Lỗi dòng ${i + 1}:`, error);
          skippedCount++;
        }

        setProgress(((i + 1) / jsonData.length) * 100);
      }

      toast({
        title: "Import thành công",
        description: `Đã thêm ${insertedCount} sản phẩm mới, cập nhật ${updatedCount} sản phẩm, bỏ qua ${skippedCount} dòng`,
      });

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể import file Excel",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import sản phẩm từ Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="excel-file">Chọn file Excel</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                disabled={isImporting}
              >
                📥 Tải file mẫu
              </Button>
            </div>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Cột cần có: Mã sản phẩm, Tên sản phẩm, Giá bán, Giá mua, Đơn vị, Nhóm sản phẩm, Mã vạch, Số lượng tồn, Id (tùy chọn)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ✅ Sản phẩm đã tồn tại (trùng mã) sẽ được <strong>CẬP NHẬT</strong> giá và thông tin
            </p>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Đang import... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setFile(null);
                setProgress(0);
              }}
              disabled={isImporting}
            >
              Hủy
            </Button>
            <Button onClick={handleImport} disabled={!file || isImporting}>
              {isImporting ? "Đang import..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
