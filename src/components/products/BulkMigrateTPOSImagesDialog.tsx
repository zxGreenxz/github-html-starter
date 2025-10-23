import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Pause, Play, Minimize2, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MigrationResult {
  productId: string;
  tposProductId: number;
  productCode: string;
  status: 'success' | 'failed' | 'skipped';
  oldUrl?: string;
  newUrl?: string;
  error?: string;
  duration?: number;
}

interface BulkMigrateTPOSImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkMigrateTPOSImagesDialog({ open, onOpenChange }: BulkMigrateTPOSImagesDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });
  const [productsToMigrate, setProductsToMigrate] = useState<any[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef(false);

  const BATCH_SIZE = 5;
  const PAUSE_BETWEEN_BATCHES = 1000; // 1 second

  useEffect(() => {
    if (open && productsToMigrate.length === 0) {
      fetchProductsToMigrate();
    }
  }, [open]);

  useEffect(() => {
    // Auto-scroll logs
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const fetchProductsToMigrate = async () => {
    try {
      addLog(`🔍 Đang tải danh sách sản phẩm...`);
      
      // Pagination loop để fetch tất cả products
      let allProducts: any[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_code, tpos_product_id, tpos_image_url")
          .not("tpos_product_id", "is", null)
          .not("tpos_image_url", "is", null)
          .range(from, from + pageSize - 1)
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        if (!data || data.length === 0) break;
        
        allProducts = [...allProducts, ...data];
        addLog(`📥 Đã tải ${allProducts.length} sản phẩm...`);
        
        // Nếu page này có ít hơn pageSize records = đây là page cuối
        if (data.length < pageSize) break;
        
        from += pageSize;
      }

      // Filter out already migrated (Supabase URLs)
      const toMigrate = allProducts.filter(p => !p.tpos_image_url.includes('supabase.co/storage'));
      
      setProductsToMigrate(toMigrate);
      setStats(prev => ({ ...prev, total: toMigrate.length }));
      addLog(`📊 Tìm thấy ${toMigrate.length} sản phẩm cần chuyển ảnh (từ ${allProducts.length} sản phẩm có TPOS image)`);
    } catch (error: any) {
      toast.error("Lỗi khi tải danh sách sản phẩm");
      addLog(`❌ Lỗi: ${error.message}`);
      console.error(error);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const startMigration = async () => {
    if (productsToMigrate.length === 0) {
      toast.error("Không có sản phẩm nào để chuyển");
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    pauseRef.current = false;
    addLog(`🚀 Bắt đầu chuyển ${productsToMigrate.length} ảnh...`);

    const totalBatches = Math.ceil(productsToMigrate.length / BATCH_SIZE);

    for (let i = currentBatch; i < totalBatches; i++) {
      if (pauseRef.current) {
        setIsPaused(true);
        addLog(`⏸️ Đã tạm dừng tại batch ${i + 1}/${totalBatches}`);
        return;
      }

      setCurrentBatch(i);
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, productsToMigrate.length);
      const batch = productsToMigrate.slice(start, end);

      addLog(`📦 Batch ${i + 1}/${totalBatches}: Xử lý ${batch.length} sản phẩm...`);

      try {
        const { data, error } = await supabase.functions.invoke('bulk-migrate-tpos-images', {
          body: { productIds: batch.map(p => p.id) }
        });

        if (error) throw error;

        const { results, summary } = data;

        // Process results
        results.forEach((result: MigrationResult) => {
          const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
          const msg = result.status === 'success' 
            ? `${icon} ${result.productCode} (${result.tposProductId}) → Migrated (${result.duration}ms)`
            : result.status === 'failed'
            ? `${icon} ${result.productCode} (${result.tposProductId}) → ${result.error}`
            : `${icon} ${result.productCode} (${result.tposProductId}) → ${result.error}`;
          
          addLog(msg);
        });

        // Update stats
        setStats(prev => ({
          ...prev,
          completed: prev.completed + batch.length,
          success: prev.success + summary.success,
          failed: prev.failed + summary.failed,
          skipped: prev.skipped + summary.skipped,
        }));

        // Update progress
        setProgress(((i + 1) / totalBatches) * 100);

        // Pause between batches
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BATCHES));
        }

      } catch (error: any) {
        addLog(`❌ Lỗi batch ${i + 1}: ${error.message}`);
        setStats(prev => ({ ...prev, failed: prev.failed + batch.length }));
      }
    }

    setIsRunning(false);
    setCurrentBatch(0);
    addLog(`✅ Hoàn tất! ${stats.success} thành công, ${stats.failed} thất bại, ${stats.skipped} bỏ qua`);
    toast.success("Chuyển ảnh hoàn tất!");
  };

  const handlePause = () => {
    pauseRef.current = true;
    setIsPaused(true);
  };

  const handleResume = () => {
    pauseRef.current = false;
    setIsPaused(false);
    startMigration();
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentBatch(0);
    setLogs([]);
    setStats({ total: 0, completed: 0, success: 0, failed: 0, skipped: 0 });
    setProductsToMigrate([]);
    pauseRef.current = false;
  };

  const exportLogs = () => {
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tpos-migration-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất logs");
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="shadow-lg gap-2"
        >
          <Upload className="h-4 w-4" />
          {isRunning ? `Đang chuyển... ${Math.round(progress)}%` : "Mở lại"}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Chuyển Ảnh TPOS Sang Supabase
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground">Tổng</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground">Hoàn thành</div>
              <div className="text-xl font-bold text-blue-500">{stats.completed}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Thành công
              </div>
              <div className="text-xl font-bold text-green-500">{stats.success}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Thất bại
              </div>
              <div className="text-xl font-bold text-red-500">{stats.failed}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Bỏ qua
              </div>
              <div className="text-xl font-bold text-yellow-500">{stats.skipped}</div>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tiến độ</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Logs */}
          <div className="flex-1 border rounded-lg p-3 bg-muted/30 overflow-hidden flex flex-col">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              📋 Logs
              <Badge variant="secondary" className="ml-auto">
                {logs.length} dòng
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 text-xs font-mono">
                {logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isRunning && !isPaused && (
              <Button
                onClick={startMigration}
                disabled={productsToMigrate.length === 0}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Bắt đầu
              </Button>
            )}
            
            {isRunning && !isPaused && (
              <Button
                onClick={handlePause}
                variant="outline"
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Tạm dừng
              </Button>
            )}
            
            {isPaused && (
              <Button
                onClick={handleResume}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Tiếp tục
              </Button>
            )}

            <Button
              onClick={exportLogs}
              variant="outline"
              disabled={logs.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Xuất Logs
            </Button>

            {!isRunning && stats.completed > 0 && (
              <Button
                onClick={handleReset}
                variant="outline"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
