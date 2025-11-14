import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Database, Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface BackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface BackupMetadata {
  version: string;
  timestamp: string;
  totalRecords: number;
  backupType: "full";
}

interface BackupData {
  metadata: BackupMetadata;
  products: any[];
}

export function BackupRestoreDialog({
  open,
  onOpenChange,
  onSuccess
}: BackupRestoreDialogProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      setProgress(0);
      setStatusMessage("Đang lấy dữ liệu từ database...");

      // Fetch all products from database
      const { data: products, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setProgress(50);
      setStatusMessage(`Đã lấy ${products?.length || 0} sản phẩm...`);

      // Create backup data with metadata
      const backupData: BackupData = {
        metadata: {
          version: "1.0",
          timestamp: new Date().toISOString(),
          totalRecords: products?.length || 0,
          backupType: "full"
        },
        products: products || []
      };

      setProgress(75);
      setStatusMessage("Đang tạo file backup...");

      // Convert to JSON and create blob
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      a.download = `Products_Backup_${timestamp}.json`;

      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);
      setStatusMessage("Hoàn tất!");

      toast.success(`Đã backup thành công ${products?.length || 0} sản phẩm!`);

      // Reset after 1 second
      setTimeout(() => {
        setProgress(0);
        setStatusMessage("");
      }, 1000);

    } catch (error) {
      console.error("❌ Error backing up products:", error);
      toast.error("Lỗi khi backup: " + (error as Error).message);
      setStatusMessage("");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    event.target.value = "";

    try {
      setIsRestoring(true);
      setProgress(0);
      setStatusMessage("Đang đọc file backup...");

      // Read file
      const fileContent = await file.text();
      const backupData: BackupData = JSON.parse(fileContent);

      // Validate backup data structure
      if (!backupData.metadata || !backupData.products || !Array.isArray(backupData.products)) {
        throw new Error("File backup không hợp lệ. Vui lòng kiểm tra lại file.");
      }

      const totalProducts = backupData.products.length;

      if (totalProducts === 0) {
        throw new Error("File backup không có dữ liệu sản phẩm.");
      }

      setProgress(10);
      setStatusMessage(`Đã đọc ${totalProducts} sản phẩm từ file backup...`);

      // Confirm restore action
      const confirmMessage = `Bạn có chắc chắn muốn restore ${totalProducts} sản phẩm?\n\n` +
        `⚠️ CẢNH BÁO:\n` +
        `- Các sản phẩm có product_code trùng sẽ bị CẬP NHẬT\n` +
        `- Các sản phẩm mới sẽ được THÊM VÀO\n` +
        `- Dữ liệu hiện tại có thể bị thay đổi\n\n` +
        `Backup date: ${new Date(backupData.metadata.timestamp).toLocaleString("vi-VN")}`;

      if (!confirm(confirmMessage)) {
        setIsRestoring(false);
        setProgress(0);
        setStatusMessage("");
        toast.info("Đã hủy restore");
        return;
      }

      setProgress(20);
      setStatusMessage("Đang xử lý restore dữ liệu...");

      // Process restore in batches to avoid timeout
      const batchSize = 100;
      let processedCount = 0;
      let insertedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < backupData.products.length; i += batchSize) {
        const batch = backupData.products.slice(i, i + batchSize);

        // Get existing product codes in this batch
        const productCodes = batch.map(p => p.product_code).filter(Boolean);
        const { data: existingProducts } = await supabase
          .from("products")
          .select("product_code")
          .in("product_code", productCodes);

        const existingCodesSet = new Set(
          existingProducts?.map(p => p.product_code) || []
        );

        // Process each product in batch
        for (const product of batch) {
          try {
            // Remove id field to let database generate new UUID for inserts
            const { id, ...productData } = product;

            if (existingCodesSet.has(product.product_code)) {
              // Update existing product
              const { error } = await supabase
                .from("products")
                .update(productData)
                .eq("product_code", product.product_code);

              if (error) throw error;
              updatedCount++;
            } else {
              // Insert new product (without id, let DB generate)
              const { error } = await supabase
                .from("products")
                .insert([productData]);

              if (error) throw error;
              insertedCount++;
            }
          } catch (error) {
            console.error(`❌ Error restoring product ${product.product_code}:`, error);
            errorCount++;
          }

          processedCount++;
          const progressPercent = 20 + (processedCount / totalProducts) * 75;
          setProgress(progressPercent);
          setStatusMessage(
            `Đang xử lý ${processedCount}/${totalProducts} sản phẩm...`
          );
        }
      }

      setProgress(100);
      setStatusMessage("Hoàn tất restore!");

      const resultMessage =
        `✅ Restore thành công!\n\n` +
        `- Thêm mới: ${insertedCount} sản phẩm\n` +
        `- Cập nhật: ${updatedCount} sản phẩm\n` +
        (errorCount > 0 ? `- Lỗi: ${errorCount} sản phẩm\n` : ``);

      toast.success(resultMessage);

      if (onSuccess) {
        onSuccess();
      }

      // Reset after 2 seconds
      setTimeout(() => {
        setProgress(0);
        setStatusMessage("");
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      console.error("❌ Error restoring products:", error);
      toast.error("Lỗi khi restore: " + (error as Error).message);
      setStatusMessage("");
      setProgress(0);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore Kho Sản Phẩm
          </DialogTitle>
          <DialogDescription>
            Quản lý backup và khôi phục dữ liệu toàn bộ bảng products từ database Supabase
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Lưu ý quan trọng:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Backup sẽ lưu toàn bộ dữ liệu dạng JSON</li>
                <li>Restore sẽ UPSERT (thêm/cập nhật) theo product_code</li>
                <li>Nên tạo backup trước khi restore</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Progress */}
          {(isBackingUp || isRestoring) && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {statusMessage}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            {/* Backup Button */}
            <Button
              onClick={handleBackup}
              disabled={isBackingUp || isRestoring}
              className="w-full gap-2"
              variant="default"
            >
              <Download className="h-4 w-4" />
              {isBackingUp ? "Đang backup..." : "Backup"}
            </Button>

            {/* Restore Button */}
            <Button
              onClick={() => document.getElementById("restore-file-input")?.click()}
              disabled={isBackingUp || isRestoring}
              className="w-full gap-2"
              variant="outline"
            >
              <Upload className="h-4 w-4" />
              {isRestoring ? "Đang restore..." : "Restore"}
            </Button>

            {/* Hidden file input for restore */}
            <input
              id="restore-file-input"
              type="file"
              accept=".json"
              onChange={handleRestore}
              className="hidden"
            />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-2 border-t pt-4">
            <p><strong>Backup:</strong> Tải xuống file JSON chứa toàn bộ dữ liệu products</p>
            <p><strong>Restore:</strong> Chọn file backup JSON để khôi phục dữ liệu</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
