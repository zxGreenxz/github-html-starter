import { useState } from 'react';
import { usePrintQueue } from '@/contexts/PrintQueueContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Pause, Play, Trash2, X, RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

export const PrintQueueMonitor = () => {
  const { queueStatus, pauseQueue, resumeQueue, clearQueue, retryFailedJob, removeJob } = usePrintQueue();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const isMobile = useIsMobile();

  const hasJobs = queueStatus.total > 0;
  const hasFailedJobs = queueStatus.failed > 0;

  if (!hasJobs && !isExpanded) {
    return null;
  }

  return (
    <>
      {/* Floating Badge */}
      {!isExpanded && hasJobs && (
        <Button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'fixed z-50 shadow-lg',
            isMobile ? 'bottom-24 right-4' : 'bottom-8 right-8',
            'bg-purple-600 hover:bg-purple-700 text-white'
          )}
          size={isMobile ? 'default' : 'lg'}
        >
          <Printer className="h-5 w-5 mr-2" />
          Hàng đợi in
          {queueStatus.processing > 0 && (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          )}
          <Badge className="ml-2 bg-amber-500 text-white">
            {queueStatus.pending + queueStatus.processing}
          </Badge>
          {hasFailedJobs && (
            <Badge className="ml-1 bg-red-500 text-white">
              {queueStatus.failed}
            </Badge>
          )}
        </Button>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <Card
          className={cn(
            'fixed z-50 shadow-2xl',
            isMobile
              ? 'bottom-0 left-0 right-0 max-h-[70vh]'
              : 'bottom-8 right-8 w-[400px] max-h-[600px]'
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-lg">Hàng đợi in</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <Badge variant={queueStatus.isPaused ? 'secondary' : 'default'}>
                {queueStatus.isPaused ? 'Đã tạm dừng' : 'Đang hoạt động'}
              </Badge>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Chờ: {queueStatus.pending}
              </Badge>
              {queueStatus.processing > 0 && (
                <Badge variant="outline" className="bg-blue-50">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Đang in: {queueStatus.processing}
                </Badge>
              )}
              {hasFailedJobs && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Lỗi: {queueStatus.failed}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Control Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={queueStatus.isPaused ? resumeQueue : pauseQueue}
                className="flex-1"
              >
                {queueStatus.isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Tiếp tục
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Tạm dừng
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                disabled={queueStatus.total === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Xóa hết
              </Button>
            </div>

            <Separator />

            {/* Queue List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {queueStatus.queue.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Printer className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Không có công việc in</p>
                  </div>
                ) : (
                  queueStatus.queue.map((job) => (
                    <Card key={job.id} className={cn(
                      'p-3',
                      job.status === 'processing' && 'border-blue-500 bg-blue-50',
                      job.status === 'failed' && 'border-red-500 bg-red-50'
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {job.status === 'pending' && (
                              <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            )}
                            {job.status === 'processing' && (
                              <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                            )}
                            {job.status === 'completed' && (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                            {job.status === 'failed' && (
                              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {job.metadata?.sessionIndex || 'Bill'}
                            </span>
                            {job.priority === 'high' && (
                              <Badge variant="destructive" className="text-xs">
                                Ưu tiên
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {job.metadata?.customerName || 'Khách hàng'}
                          </p>
                          {job.metadata?.productCode && (
                            <p className="text-xs text-muted-foreground truncate">
                              {job.metadata.productCode}
                            </p>
                          )}
                          {job.error && (
                            <p className="text-xs text-red-600 mt-1">
                              Lỗi: {job.error}
                            </p>
                          )}
                          {job.retryCount > 0 && (
                            <p className="text-xs text-amber-600">
                              Thử lại: {job.retryCount}/{job.maxRetries}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {job.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => retryFailedJob(job.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          {(job.status === 'pending' || job.status === 'failed') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeJob(job.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ hàng đợi?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa tất cả {queueStatus.total} công việc in đang chờ và không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearQueue();
                setShowClearDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa hết
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
