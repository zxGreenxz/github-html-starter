import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

interface ImportTPOSVariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportTPOSVariantsDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportTPOSVariantsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Helper to parse price strings like "320,000" to 320000
  const parsePrice = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') return priceStr;
    // Remove commas, dots, and non-numeric characters except digits
    const cleaned = priceStr.toString().replace(/[,\.]/g, '').replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Id sản phẩm (*)": 122953,
        "Tên sản phẩm": "[LSET1] TH SET NGÔI SAO QUẦN SUÔNG XANH",
        "Giá biến thể": "320,000",
      },
      {
        "Id sản phẩm (*)": 122954,
        "Tên sản phẩm": "[LSET2] TH SET 3 MÓN POLO SỌC XANH + CV",
        "Giá biến thể": "340,000",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Variants");
    XLSX.writeFile(wb, "template_import_tpos_variants.xlsx");

    toast({
      title: "Đã tải file mẫu",
      description: "File template đã được tải xuống",
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Chưa chọn file",
        description: "Vui lòng chọn file Excel để import",
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
      
      // Normalize column names to handle special characters
      const normalizeColumnName = (name: string) => {
        return name.trim().replace(/\\\*/g, '*');
      };

      const rawData = XLSX.utils.sheet_to_json(worksheet);
      const jsonData = rawData.map(row => {
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          normalizedRow[normalizeColumnName(key)] = (row as any)[key];
        });
        return normalizedRow;
      });

      if (jsonData.length === 0) {
        toast({
          title: "File trống",
          description: "File Excel không có dữ liệu",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Debug: Log first row column names
      console.log("📋 Column names detected:", Object.keys(jsonData[0]));
      console.log("📋 First row sample:", jsonData[0]);
      console.log("📊 Total rows to process:", jsonData.length);

      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        const variantId = row["Id sản phẩm (*)"];
        const productName = row["Tên sản phẩm"]?.toString().trim();
        const sellingPrice = row["Giá biến thể"];

        if (!variantId) {
          console.warn(`⚠️ Bỏ qua dòng ${i + 2}: Thiếu Id sản phẩm (*)`);
          skippedCount++;
          setProgress(((i + 1) / jsonData.length) * 100);
          continue;
        }

        // Find product by productid_bienthe
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id, product_code, product_name")
          .eq("productid_bienthe", parseInt(variantId.toString()))
          .maybeSingle();

        if (!existingProduct) {
          console.warn(`⚠️ Bỏ qua ID ${variantId}: Không tìm thấy sản phẩm với productid_bienthe=${variantId}`);
          skippedCount++;
          setProgress(((i + 1) / jsonData.length) * 100);
          continue;
        }

        // Prepare update data
        const updateData: any = {};

        // Update selling_price if provided
        if (sellingPrice !== undefined && sellingPrice !== null) {
          updateData.selling_price = parsePrice(sellingPrice);
        }

        // Only update if there's data to update
        if (Object.keys(updateData).length === 0) {
          console.warn(`⚠️ Bỏ qua ID ${variantId}: Không có dữ liệu để cập nhật`);
          skippedCount++;
          setProgress(((i + 1) / jsonData.length) * 100);
          continue;
        }

        // Update the product
        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", existingProduct.id);

        if (!error) {
          const displayName = productName || existingProduct.product_name || existingProduct.product_code;
          const priceDisplay = sellingPrice ? ` Giá bán = ${new Intl.NumberFormat('vi-VN').format(updateData.selling_price)}đ` : '';
          console.log(`✅ Cập nhật ${displayName} (ID: ${variantId}):${priceDisplay}`);
          updatedCount++;
        } else {
          console.error(`❌ Lỗi update ID ${variantId}:`, error);
          skippedCount++;
        }

        setProgress(((i + 1) / jsonData.length) * 100);
      }

      toast({
        title: "Import thành công",
        description: `✅ Cập nhật: ${updatedCount} sản phẩm${skippedCount > 0 ? `\n⚠️ Bỏ qua: ${skippedCount} dòng (không tìm thấy trong DB)` : ''}`,
        duration: 5000,
      });

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Lỗi import",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import ID Biến Thể TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isImporting}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={downloadTemplate}
                disabled={isImporting}
                title="Tải file mẫu"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Cột cần có: <strong>Id sản phẩm (*)</strong>, Tên sản phẩm (tùy chọn), <strong>Giá biến thể</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Hệ thống sẽ tìm sản phẩm theo <strong>Id sản phẩm (*)</strong> và cập nhật <strong>selling_price</strong>
            </p>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-center text-muted-foreground">
                Đang import... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
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
            <Button onClick={handleImport} disabled={isImporting || !file}>
              {isImporting ? "Đang import..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
