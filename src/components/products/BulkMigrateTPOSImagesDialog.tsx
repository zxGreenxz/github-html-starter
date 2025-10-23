import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pause, Play, Download, Minimize2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MigrationLog {
  type: "success" | "error" | "warning" | "info";
  product_code: string;
  product_name: string;
  message: string;
  timestamp: Date;
}

interface BulkMigrateTPOSImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function BulkMigrateTPOSImagesDialog({
  open,
  onOpenChange,
  onComplete,
}: BulkMigrateTPOSImagesDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "completed">("idle");
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [productCodes, setProductCodes] = useState<string[]>([]);

  useEffect(() => {
    if (open && status === "idle") {
      fetchProductCount();
    }
  }, [open]);

  const fetchProductCount = async () => {
    try {
      const { count, error } = await supabase
        .from("products")
        .select("product_code", { count: "exact", head: true })
        .not("tpos_image_url", "is", null)
        .is("base_product_code", null)
        .like("tpos_image_url", "%tpos.vn%");

      if (error) throw error;
      setTotal(count || 0);

      // Fetch all product codes
      const { data } = await supabase
        .from("products")
        .select("product_code")
        .not("tpos_image_url", "is", null)
        .is("base_product_code", null)
        .like("tpos_image_url", "%tpos.vn%");

      if (data) {
        setProductCodes(data.map(p => p.product_code));
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addLog = (log: Omit<MigrationLog, "timestamp">) => {
    setLogs(prev => [{ ...log, timestamp: new Date() }, ...prev].slice(0, 500));
  };

  const startMigration = async () => {
    if (productCodes.length === 0) {
      toast({
        title: "Không có ảnh",
        description: "Không tìm thấy ảnh TPOS cần chuyển",
        variant: "destructive",
      });
      return;
    }

    setStatus("running");
    setCompleted(0);
    setFailed(0);
    setLogs([]);

    addLog({
      type: "info",
      product_code: "SYSTEM",
      product_name: "System",
      message: `Bắt đầu chuyển ${total} ảnh TPOS...`,
    });

    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < productCodes.length; i += BATCH_SIZE) {
      if (status === "paused") {
        break;
      }

      const batch = productCodes.slice(i, i + BATCH_SIZE);
      
      addLog({
        type: "info",
        product_code: "SYSTEM",
        product_name: "System",
        message: `Xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(productCodes.length / BATCH_SIZE)}...`,
      });

      try {
        const { data, error } = await supabase.functions.invoke("bulk-migrate-tpos-images", {
          body: { productCodes: batch, batchSize: 5 },
        });

        if (error) throw error;

        // Process results
        data.success?.forEach((result: any) => {
          processedCount++;
          setCompleted(prev => prev + 1);
          addLog({
            type: "success",
            product_code: result.product_code,
            product_name: result.product_name,
            message: "Chuyển thành công",
          });
        });

        data.failed?.forEach((result: any) => {
          processedCount++;
          setFailed(prev => prev + 1);
          addLog({
            type: "error",
            product_code: result.product_code,
            product_name: result.product_name,
            message: result.error,
          });
        });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        addLog({
          type: "error",
          product_code: "SYSTEM",
          product_name: "System",
          message: `Lỗi batch: ${error.message}`,
        });
      }
    }

    setStatus("completed");
    addLog({
      type: "info",
      product_code: "SYSTEM",
      product_name: "System",
      message: `✅ Hoàn tất! Thành công: ${completed}, Thất bại: ${failed}`,
    });

    toast({
      title: "Hoàn tất migration!",
      description: `✅ ${completed} thành công, ❌ ${failed} thất bại`,
    });

    onComplete?.();
  };

  const exportLogs = () => {
    const logText = logs
      .map(log => {
        const icon = log.type === "success" ? "✅" : log.type === "error" ? "❌" : log.type === "warning" ? "⚠️" : "ℹ️";
        return `${icon} [${log.timestamp.toLocaleTimeString()}] ${log.product_code} - ${log.message}`;
      })
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tpos-migration-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Chuyển Ảnh TPOS Sang Supabase</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {!isMinimized && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{total}</div>
                  <p className="text-xs text-muted-foreground">Tổng cộng</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{completed}</div>
                  <p className="text-xs text-muted-foreground">Thành công</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">{failed}</div>
                  <p className="text-xs text-muted-foreground">Thất bại</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {total - completed - failed}
                  </div>
                  <p className="text-xs text-muted-foreground">Còn lại</p>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tiến độ</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2">
              {status === "idle" && (
                <Button onClick={startMigration} disabled={total === 0}>
                  <Play className="h-4 w-4 mr-2" />
                  Bắt Đầu
                </Button>
              )}
              {status === "running" && (
                <Button onClick={() => setStatus("paused")} variant="outline">
                  <Pause className="h-4 w-4 mr-2" />
                  Tạm Dừng
                </Button>
              )}
              {status === "paused" && (
                <Button onClick={() => setStatus("running")}>
                  <Play className="h-4 w-4 mr-2" />
                  Tiếp Tục
                </Button>
              )}
              <Button
                variant="outline"
                onClick={exportLogs}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Xuất Report
              </Button>
            </div>

            {/* Logs */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Logs</h3>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Chưa có logs
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-xs font-mono"
                      >
                        {log.type === "success" && (
                          <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5" />
                        )}
                        {log.type === "error" && (
                          <XCircle className="h-3 w-3 text-red-600 mt-0.5" />
                        )}
                        {log.type === "warning" && (
                          <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5" />
                        )}
                        {log.type === "info" && (
                          <Loader2 className="h-3 w-3 text-blue-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span className="text-muted-foreground">
                            [{log.timestamp.toLocaleTimeString()}]
                          </span>{" "}
                          <span className="font-semibold">{log.product_code}</span> -{" "}
                          {log.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Summary */}
            {status === "completed" && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">✅ Migration Hoàn Tất!</h3>
                  <div className="space-y-1 text-sm">
                    <p>📊 Tổng: {total} sản phẩm</p>
                    <p>✅ Thành công: {completed} ({Math.round((completed / total) * 100)}%)</p>
                    <p>❌ Thất bại: {failed} ({Math.round((failed / total) * 100)}%)</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {isMinimized && (
          <div className="py-8 text-center">
            <div className="text-4xl font-bold mb-2">
              {completed + failed} / {total}
            </div>
            <p className="text-sm text-muted-foreground">
              Đang chuyển ảnh... ({Math.round(progress)}%)
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
