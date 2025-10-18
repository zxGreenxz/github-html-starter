import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";

interface ImportTPOSIdsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportTPOSIdsDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportTPOSIdsDialogProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [tposFile, setTposFile] = useState<File | null>(null);
  const [variantFile, setVariantFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });

  const handleImport = async () => {
    if (!tposFile && !variantFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một file để import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    let updatedCount = 0;
    let errorCount = 0;

    try {
      // Import TPOS Product IDs from file 1
      if (tposFile) {
        setProgress({ current: 0, total: 1, message: "Đang đọc file sản phẩm TPOS..." });
        
        const data = await tposFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
          Id: number;
          "Mã sản phẩm": string;
          "Mã vạch": string;
        }>;

        setProgress({ current: 0, total: jsonData.length, message: "Đang cập nhật tpos_product_id..." });

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const tposProductId = row.Id;
          const barcode = row["Mã vạch"];
          
          if (!tposProductId || !barcode) continue;

          try {
            // Update products table matching by product_code or barcode
            const { error } = await supabase
              .from("products")
              .update({ tpos_product_id: tposProductId })
              .or(`product_code.eq.${barcode},barcode.eq.${barcode}`);

            if (error) {
              console.error(`Error updating product ${barcode}:`, error);
              errorCount++;
            } else {
              updatedCount++;
            }
          } catch (err) {
            console.error(`Error processing row ${i + 1}:`, err);
            errorCount++;
          }

          setProgress({ 
            current: i + 1, 
            total: jsonData.length, 
            message: `Đã cập nhật ${updatedCount} sản phẩm (${i + 1}/${jsonData.length})` 
          });
        }
      }

      // Import Variant IDs from file 2
      if (variantFile) {
        setProgress({ current: 0, total: 1, message: "Đang đọc file biến thể..." });
        
        const data = await variantFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
          "Id sản phẩm (*)": number;
          "Mã sản phẩm": string;
        }>;

        setProgress({ current: 0, total: jsonData.length, message: "Đang cập nhật productid_bienthe..." });

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const variantId = row["Id sản phẩm (*)"];
          const productCode = row["Mã sản phẩm"];
          
          if (!variantId || !productCode) continue;

          try {
            // Update products table matching by product_code or barcode
            const { error } = await supabase
              .from("products")
              .update({ productid_bienthe: variantId })
              .or(`product_code.eq.${productCode},barcode.eq.${productCode}`);

            if (error) {
              console.error(`Error updating variant ${productCode}:`, error);
              errorCount++;
            } else {
              updatedCount++;
            }
          } catch (err) {
            console.error(`Error processing variant row ${i + 1}:`, err);
            errorCount++;
          }

          setProgress({ 
            current: i + 1, 
            total: jsonData.length, 
            message: `Đã cập nhật ${updatedCount} biến thể (${i + 1}/${jsonData.length})` 
          });
        }
      }

      toast({
        title: "Import thành công",
        description: `Đã cập nhật ${updatedCount} sản phẩm${errorCount > 0 ? `, ${errorCount} lỗi` : ""}`,
      });

      onSuccess();
      onOpenChange(false);
      setTposFile(null);
      setVariantFile(null);
      setProgress({ current: 0, total: 0, message: "" });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Lỗi import",
        description: error.message || "Có lỗi xảy ra khi import dữ liệu",
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
          <DialogTitle>Import TPOS IDs và Variant IDs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tpos-file">
              File 1: Sản phẩm TPOS (Cột A = tpos_product_id)
            </Label>
            <Input
              id="tpos-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setTposFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              File chứa cột "Id" và "Mã vạch" để cập nhật tpos_product_id
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant-file">
              File 2: Biến thể sản phẩm (Cột A = productid_bienthe)
            </Label>
            <Input
              id="variant-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setVariantFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              File chứa cột "Id sản phẩm (*)" và "Mã sản phẩm" để cập nhật productid_bienthe
            </p>
          </div>

          {isImporting && progress.total > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{progress.message}</div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Hủy
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || (!tposFile && !variantFile)}
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
