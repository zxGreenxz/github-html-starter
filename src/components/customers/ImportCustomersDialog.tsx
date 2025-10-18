import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Helper function to map status text (copied from src/pages/Customers.tsx for client-side use)
const mapStatusText = (statusText: string | null | undefined): string => {
  if (!statusText) return "Bình thường";

  const normalizedStatus = statusText.trim().toLowerCase();
  const statusMap: Record<string, string> = {
    normal: "Bình thường",
    bomb: "Bom hàng",
    warning: "Cảnh báo",
    wholesale: "Khách sỉ",
    danger: "Nguy hiểm",
    close: "Thân thiết",
    vip: "VIP",
    "thieu thong tin": "Thiếu thông tin",
    incomplete: "Cần thêm TT",
    "bình thường": "Bình thường",
    "bom hàng": "Bom hàng",
    "cảnh báo": "Cảnh báo",
    "khách sỉ": "Khách sỉ",
    "nguy hiểm": "Nguy hiểm",
    "thân thiết": "Thân thiết",
    "thiếu thông tin": "Thiếu thông tin",
    "cần thêm tt": "Cần thêm TT",
    "chưa có tt": "Chưa có TT",
  };
  return statusMap[normalizedStatus] || "Bình thường";
};

const BATCH_SIZE = 1000; // Kích thước lô được điều chỉnh thành 1000 dòng

export function ImportCustomersDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportCustomersDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const handleImport = async () => {
    if (!file) {
      toast.error("Vui lòng chọn file Excel hoặc CSV");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for UI update

    try {
      // --- NEW: Check TPOS credentials before starting import ---
      const { data: checkResult, error: checkError } =
        await supabase.functions.invoke("check-tpos-credentials");

      if (checkError || !checkResult.is_valid) {
        toast.error(
          checkResult.error ||
            checkError?.message ||
            "Lỗi không xác định khi kiểm tra TPOS credentials.",
        );
        setIsImporting(false);
        return; // Stop import if credentials are not valid
      }
      toast.success("TPOS credentials hợp lệ, đang tiến hành import...");
      // --- END NEW CHECK ---

      const reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, {
            type: "array",
            raw: false,
          });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          let totalProcessedCount = 0;
          let totalSkippedCount = 0;
          const customersToUpsert: any[] = [];

          const totalRows = jsonData.length;

          for (let i = 0; i < totalRows; i++) {
            const row: any = jsonData[i];
            const customerName = row["Tên khách hàng"]?.toString().trim();
            const facebookId = row["Facebook ID"]?.toString().trim() || null;
            let idKH = row["IdKH"]?.toString().trim() || null;

            if (!customerName) {
              totalSkippedCount++;
              continue;
            }

            if (!idKH) {
              idKH = crypto.randomUUID();
            }

            const customerData: any = {
              idkh: idKH,
              customer_name: customerName,
              phone: row["Điện thoại"]?.toString().trim() || null,
              email: row["Email"]?.toString().trim() || null,
              address: row["Địa chỉ"]?.toString().trim() || null,
              notes: row["Ghi chú"]?.toString().trim() || null,
              customer_status: mapStatusText(
                row["Trạng thái khách hàng"]?.toString().trim(),
              ),
              info_status:
                row["Trạng thái thông tin"]?.toString().trim() || "incomplete",
              facebook_id: facebookId,
              total_orders: row["Đơn hàng"]
                ? parseInt(row["Đơn hàng"].toString())
                : 0,
              total_spent: row["Tổng chi"]
                ? parseFloat(row["Tổng chi"].toString())
                : 0,
            };

            customersToUpsert.push(customerData);
          }

          if (customersToUpsert.length > 0) {
            const totalBatches = Math.ceil(
              customersToUpsert.length / BATCH_SIZE,
            );
            let currentBatch = 0;

            for (let i = 0; i < customersToUpsert.length; i += BATCH_SIZE) {
              currentBatch++;
              const batch = customersToUpsert.slice(i, i + BATCH_SIZE);

              // Update progress before sending batch
              setProgress(Math.floor((i / customersToUpsert.length) * 100));
              await new Promise((resolve) => setTimeout(resolve, 100)); // Yield control

              const { data, error } = await supabase
                .from("customers")
                .upsert(batch, {
                  onConflict: "idkh",
                  ignoreDuplicates: false,
                })
                .select("id");

              if (error) {
                console.error(
                  `Supabase upsert error in batch ${currentBatch}/${totalBatches}:`,
                  error,
                );
                toast.error(
                  `Lỗi khi import lô ${currentBatch}/${totalBatches}: ${error.message}`,
                );
                // Stop further processing if a batch fails
                throw new Error(`Import failed at batch ${currentBatch}`);
              } else {
                totalProcessedCount += data.length;
                console.log(
                  `Processed batch ${currentBatch}/${totalBatches}: ${data.length} customers`,
                );
              }

              // Add a delay between batches to prevent overwhelming the database
              if (i + BATCH_SIZE < customersToUpsert.length) {
                await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 second delay
              }
            }

            toast.success(
              `Import hoàn tất: Đã xử lý ${totalProcessedCount} khách hàng (thêm mới/cập nhật).`,
            );
          } else {
            toast.info("Không có dữ liệu khách hàng hợp lệ để import.");
          }

          onSuccess();
          onOpenChange(false);
          setFile(null);
        } catch (error: any) {
          console.error("Import error during file processing:", error);
          toast.error(error.message || "Có lỗi xảy ra khi xử lý file");
        } finally {
          setIsImporting(false);
          setProgress(0);
        }
      };

      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        toast.error("Lỗi khi đọc file Excel hoặc CSV.");
        setIsImporting(false);
        setProgress(0);
      };
    } catch (error: any) {
      // Catch errors from the initial credential check
      console.error("Initial import check error:", error);
      toast.error(error.message || "Có lỗi xảy ra trước khi bắt đầu import.");
      setIsImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import khách hàng từ Excel/CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="excel-file">Chọn file Excel hoặc CSV</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Các cột cần có: "Tên khách hàng" (bắt buộc), "Điện thoại",
              "Email", "Địa chỉ", "Ghi chú", "Trạng thái khách hàng", "Trạng
              thái thông tin", "Facebook ID", **"IdKH"**, "Đơn hàng", "Tổng
              chi".
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ⚠️ Nếu "IdKH" tồn tại, khách hàng sẽ được CẬP NHẬT dựa trên IdKH.
              Nếu "IdKH" không có, khách hàng sẽ được THÊM MỚI.
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
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang import...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
