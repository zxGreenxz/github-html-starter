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

  const downloadTemplate = () => {
    const template = [
      {
        "Id sản phẩm (*)": 122953,
        "Mã": "LSET1",
        "Tên sản phẩm": "[LSET1] TH SET NGÔI SAO QUẦN SUÔNG XANH",
        "Giá trị tồn (*)": 0,
      },
      {
        "Id sản phẩm (*)": 122954,
        "Mã": "LSET2",
        "Tên sản phẩm": "[LSET2] TH SET NGÔI SAO QUẦN SUÔNG ĐỎ",
        "Giá trị tồn (*)": 5,
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: "File trống",
          description: "File Excel không có dữ liệu",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        const productCode = row["Mã"]?.toString().trim();
        const variantId = row["Id sản phẩm (*)"];
        const stockQuantity = row["Giá trị tồn (*)"];

        if (!productCode || !variantId) {
          console.warn(`Bỏ qua dòng ${i + 2}: thiếu Mã hoặc Id sản phẩm`);
          skippedCount++;
          setProgress(((i + 1) / jsonData.length) * 100);
          continue;
        }

        const updateData: any = {
          productid_bienthe: parseInt(variantId.toString()),
        };

        // Only update stock_quantity if provided
        if (stockQuantity !== undefined && stockQuantity !== null) {
          updateData.stock_quantity = parseInt(stockQuantity.toString() || "0");
        }

        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("product_code", productCode);

        if (!error) {
          console.log(`✅ Cập nhật ${productCode}: productid_bienthe = ${variantId}`);
          updatedCount++;
        } else {
          console.error(`❌ Lỗi update ${productCode}:`, error);
          skippedCount++;
        }

        setProgress(((i + 1) / jsonData.length) * 100);
      }

      toast({
        title: "Import thành công",
        description: `Đã cập nhật ${updatedCount} sản phẩm, bỏ qua ${skippedCount} dòng`,
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
              Cột cần có: <strong>Id sản phẩm (*)</strong>, <strong>Mã</strong>, Tên sản phẩm, <strong>Giá trị tồn (*)</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Hệ thống sẽ cập nhật <strong>productid_bienthe</strong> và <strong>stock_quantity</strong> dựa trên <strong>Mã sản phẩm</strong>
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
