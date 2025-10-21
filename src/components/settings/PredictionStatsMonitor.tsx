import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, TrendingUp, Clock } from 'lucide-react';

export function PredictionStatsMonitor() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['prediction-stats'],
    queryFn: async () => {
      // Get prediction statistics (last 7 days only for performance)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: orders } = await supabase
        .from('facebook_pending_orders')
        .select('prediction_method, is_prediction_correct, predicted_session_index, session_index')
        .not('prediction_method', 'is', null)
        .gte('created_time', sevenDaysAgo);
      
      const total = orders?.length || 0;
      const predicted = orders?.filter(d => d.prediction_method === 'predicted').length || 0;
      const correct = orders?.filter(d => d.is_prediction_correct === true).length || 0;
      const incorrect = orders?.filter(d => d.is_prediction_correct === false).length || 0;
      
      // Get recent corrections
      const { data: corrections } = await supabase
        .from('session_index_corrections')
        .select('*')
        .order('corrected_at', { ascending: false })
        .limit(5);
      
      return {
        total,
        predicted,
        correct,
        incorrect,
        accuracy: predicted > 0 ? (correct / predicted * 100).toFixed(1) : '0',
        corrections: corrections || []
      };
    },
    refetchInterval: (query) => {
      // Only refresh if tab is active
      return document.visibilityState === 'visible' ? 30000 : false;
    }
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Tổng đơn</div>
          <div className="text-2xl font-bold">{stats?.total}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Đơn dự đoán</div>
          <div className="text-2xl font-bold text-blue-600">{stats?.predicted}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Dự đoán đúng
          </div>
          <div className="text-2xl font-bold text-green-600">{stats?.correct}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Dự đoán sai
          </div>
          <div className="text-2xl font-bold text-orange-600">{stats?.incorrect}</div>
        </Card>
      </div>

      {/* Accuracy */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Độ chính xác
          </span>
          <Badge variant={Number(stats?.accuracy) >= 95 ? 'default' : 'secondary'}>
            {stats?.accuracy}%
          </Badge>
        </div>
        <Progress value={Number(stats?.accuracy)} className="h-2" />
      </div>

      {/* Recent Corrections */}
      {stats?.corrections && stats.corrections.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sửa gần đây (7 ngày)
          </div>
          <div className="space-y-2">
            {stats.corrections.map((correction: any) => (
              <div 
                key={correction.id}
                className="text-xs p-2 border rounded-md bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">
                    #{correction.predicted} → #{correction.actual}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {correction.confidence}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-1">
                  {new Date(correction.corrected_at).toLocaleString('vi-VN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
