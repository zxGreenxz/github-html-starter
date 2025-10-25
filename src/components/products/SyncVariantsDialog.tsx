import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, X } from "lucide-react";
import { syncAllVariants, type SyncProgress } from "@/lib/tpos-product-sync";
import { toast } from "sonner";

interface SyncVariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SyncVariantsDialog({
  open,
  onOpenChange,
  onSuccess,
}: SyncVariantsDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    logs: [],
  });

  const handleStartSync = async () => {
    setIsRunning(true);
    setProgress({
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      logs: ["🚀 Bắt đầu đồng bộ biến thể..."],
    });

    try {
      await syncAllVariants((newProgress) => {
        setProgress(newProgress);
      });

      toast.success("Đồng bộ biến thể hoàn tất!", {
        description: `✅ ${progress.success} thành công, ❌ ${progress.failed} lỗi`,
      });
      
      onSuccess();
    } catch (error) {
      console.error("Sync variants error:", error);
      toast.error("Lỗi đồng bộ biến thể", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onOpenChange(false);
      setTimeout(() => {
        setProgress({
          current: 0,
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          logs: [],
        });
      }, 300);
    }
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Đồng bộ biến thể từ TPOS</DialogTitle>
          <DialogDescription>
            Cập nhật giá bán, giá mua, tồn kho và dự báo cho tất cả biến thể
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Progress section */}
          {progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isRunning ? "⚙️ Đang xử lý" : "✅ Hoàn tất"}: {progress.current}/{progress.total} biến thể
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Stats */}
          {progress.total > 0 && (
            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                  {progress.success}
                </div>
                <div className="text-xs text-muted-foreground">Thành công</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                  {progress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Lỗi</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                  {progress.skipped}
                </div>
                <div className="text-xs text-muted-foreground">Bỏ qua</div>
              </div>
            </div>
          )}

          {/* Logs */}
          {progress.logs.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0">
              <h4 className="text-sm font-medium mb-2">📝 Logs</h4>
              <ScrollArea className="flex-1 rounded-md border p-4">
                <div className="space-y-1 font-mono text-xs">
                  {progress.logs.map((log, index) => (
                    <div key={index} className="break-all">
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Start message */}
          {progress.total === 0 && !isRunning && (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-8">
              <div>
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nhấn "Bắt đầu đồng bộ" để bắt đầu</p>
                <p className="text-xs mt-2">
                  Quá trình này sẽ cập nhật giá bán (PriceVariant), giá mua (StandardPrice), 
                  tồn kho (QtyAvailable) và dự báo (VirtualAvailable) cho tất cả biến thể
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {!isRunning && progress.total === 0 && (
            <Button onClick={handleStartSync} disabled={isRunning}>
              <Package className="h-4 w-4 mr-2" />
              Bắt đầu đồng bộ
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRunning}
          >
            <X className="h-4 w-4 mr-2" />
            {isRunning ? "Đang chạy..." : "Đóng"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
