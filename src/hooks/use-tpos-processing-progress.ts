import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast as sonnerToast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface ProgressState {
  successCount: number;
  failedCount: number;
  completedCount: number;
  totalItems: number;
  isComplete: boolean;
}

interface UseTPOSProgressOptions {
  orderId: string;
  totalItems: number;
  toastId: string;
  onComplete: (state: ProgressState) => void;
  skipInitialQuery?: boolean;
}

/**
 * Hook to monitor TPOS processing progress using Realtime subscriptions
 * with automatic fallback to polling if connection fails.
 */
export function useTPOSProcessingProgress({
  orderId,
  totalItems,
  toastId,
  onComplete,
  skipInitialQuery = false
}: UseTPOSProgressOptions) {
  const queryClient = useQueryClient();

  const [progressState, setProgressState] = useState<ProgressState>({
    successCount: 0,
    failedCount: 0,
    completedCount: 0,
    totalItems,
    isComplete: false
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recurringPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const lastCompletedCountRef = useRef<number>(0);
  const isCompleteRef = useRef(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const isCleanedUpRef = useRef(false);

  // ✅ CLEANUP: Prevent memory leaks (defined first)
  const cleanup = useCallback(() => {
    console.log('🧹 [Realtime] Cleaning up subscriptions...');
    isCleanedUpRef.current = true;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    if (queryDebounceTimeoutRef.current) {
      clearTimeout(queryDebounceTimeoutRef.current);
      queryDebounceTimeoutRef.current = null;
    }

    if (recurringPollIntervalRef.current) {
      clearInterval(recurringPollIntervalRef.current);
      recurringPollIntervalRef.current = null;
    }
  }, []);

  // ✅ COMPLETION: Handle completion logic
  const handleCompletion = useCallback((state: ProgressState) => {
    if (isCleanedUpRef.current) return;

    console.log('✅ [Realtime] Processing complete:', state);

    const { successCount, failedCount } = state;

    if (failedCount === 0) {
      sonnerToast.success(
        `✅ Đã tạo thành công ${successCount} sản phẩm trên TPOS!`,
        { id: toastId, duration: 5000 }
      );
    } else if (successCount === 0) {
      sonnerToast.error(
        `❌ Tất cả ${failedCount} sản phẩm đều lỗi. Vui lòng kiểm tra chi tiết.`,
        { id: toastId, duration: 5000 }
      );
    } else {
      sonnerToast.warning(
        `⚠️ ${successCount} thành công, ${failedCount} lỗi. Bạn có thể retry trong chi tiết đơn hàng.`,
        { id: toastId, duration: 7000 }
      );
    }

    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["products-select"] });

    onComplete(state);
    cleanup();
  }, [toastId, queryClient, onComplete, cleanup]);

  // ✅ SAFETY: Fetch current state from DB
  const fetchProgressState = useCallback(async () => {
    if (isCleanedUpRef.current || isCompleteRef.current) return;

    try {
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('tpos_sync_status')
        .eq('purchase_order_id', orderId);

      if (items && !isCleanedUpRef.current && !isCompleteRef.current) {
        const successCount = items.filter(i => i.tpos_sync_status === 'success').length;
        const failedCount = items.filter(i => i.tpos_sync_status === 'failed').length;
        const completedCount = successCount + failedCount;
        const isComplete = completedCount >= totalItems;

        setProgressState({
          successCount,
          failedCount,
          completedCount,
          totalItems,
          isComplete
        });

        if (isComplete) {
          isCompleteRef.current = true;
        }

        const progressChange = completedCount - lastCompletedCountRef.current;
        if (progressChange >= 2 || isComplete || lastCompletedCountRef.current === 0) {
          if (!isComplete) {
            sonnerToast.loading(
              `Đang xử lý ${completedCount}/${totalItems} sản phẩm... (${successCount} ✅, ${failedCount} ❌)`,
              { id: toastId, duration: Infinity }
            );
          }
          lastCompletedCountRef.current = completedCount;
        }

        if (isComplete) {
          handleCompletion({ successCount, failedCount, completedCount, totalItems, isComplete: true });
        }
      }
    } catch (error) {
      console.error('❌ [Realtime] Error fetching progress:', error);
    }
  }, [orderId, totalItems, toastId, handleCompletion]);

  // ✅ DEBOUNCED: Re-query to prevent spam
  const debouncedFetchProgress = useCallback(() => {
    if (queryDebounceTimeoutRef.current) {
      clearTimeout(queryDebounceTimeoutRef.current);
    }

    queryDebounceTimeoutRef.current = setTimeout(() => {
      if (!isCleanedUpRef.current) {
        fetchProgressState();
      }
    }, 300);
  }, [fetchProgressState]);

  // ✅ FALLBACK: Polling mechanism
  const activateFallbackPolling = useCallback(() => {
    if (isFallbackMode || isCompleteRef.current || isCleanedUpRef.current) return;

    console.log('🔄 [Fallback] Activating polling mode...');
    setIsFallbackMode(true);

    let pollInterval = 2000;
    let pollCount = 0;
    const MAX_POLLS = 60;

    const poll = async () => {
      if (pollCount++ >= MAX_POLLS || isCompleteRef.current || isCleanedUpRef.current) {
        return;
      }

      await fetchProgressState();

      if (!isCompleteRef.current && !isCleanedUpRef.current) {
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [isFallbackMode, fetchProgressState]);

  // ✅ HEARTBEAT: Detect stale connections
  const startHeartbeatCheck = useCallback(() => {
    const checkHeartbeat = () => {
      if (isCleanedUpRef.current || isCompleteRef.current) return;

      const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;

      if (timeSinceLastUpdate > 15000 && !isCompleteRef.current && !isFallbackMode) {
        console.warn('💔 [Realtime] No updates for 15s, falling back to polling...');
        activateFallbackPolling();
      } else if (!isCleanedUpRef.current && !isCompleteRef.current) {
        heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 10000);
      }
    };

    heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 10000);
  }, [isFallbackMode, activateFallbackPolling]);

  const resetHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    startHeartbeatCheck();
  }, [startHeartbeatCheck]);

  // ✅ RESET: Reset refs when orderId changes
  useEffect(() => {
    if (orderId) {
      console.log('🔄 [Realtime] Resetting refs for new orderId:', orderId);
      isCompleteRef.current = false;
      isCleanedUpRef.current = false;
      lastCompletedCountRef.current = 0;
      lastUpdateTimeRef.current = Date.now();
    }
  }, [orderId]);

  // ✅ INITIAL: Fetch initial state on mount
  useEffect(() => {
    if (!orderId) return;

    if (!skipInitialQuery) {
      console.log('🔍 [Realtime] Fetching initial state...');
      fetchProgressState();
    } else {
      console.log('⏭️ [Realtime] Skipping initial query (new order)');
    }
  }, [orderId, skipInitialQuery, fetchProgressState]);

  // ✅ REALTIME: Subscribe to changes
  useEffect(() => {
    if (!orderId || progressState.isComplete || isCleanedUpRef.current) return;

    console.log('🔴 [Realtime] Setting up subscription for order:', orderId);

    const channel = supabase
      .channel(`purchase_order_items:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchase_order_items',
          filter: `purchase_order_id=eq.${orderId}`
        },
        async (payload) => {
          if (isCleanedUpRef.current) return;

          console.log('📨 [Realtime] Received update:', payload.new);

          lastUpdateTimeRef.current = Date.now();
          resetHeartbeatTimeout();

          debouncedFetchProgress();
        }
      )
      .subscribe((status) => {
        if (isCleanedUpRef.current) return;

        console.log('🔴 [Realtime] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Connected successfully');
          setIsFallbackMode(false);
          resetHeartbeatTimeout();

          // ✅ IMMEDIATE POLL: Query DB right after subscription to catch already-completed items
          // This handles cases where background completes before subscription is ready
          console.log('🔍 [Realtime] Polling immediately after subscription...');
          setTimeout(() => {
            if (!isCleanedUpRef.current && !isCompleteRef.current) {
              fetchProgressState();
            }
          }, 1000); // 1s delay to allow background to start

          // ✅ RECURRING POLL: Poll every 3s as backup (max 40 times = 2 minutes)
          // This ensures toast dismisses even if Realtime fails silently
          let pollCount = 0;
          const pollInterval = setInterval(() => {
            pollCount++;
            if (pollCount >= 40 || isCompleteRef.current || isCleanedUpRef.current) {
              clearInterval(pollInterval);
              recurringPollIntervalRef.current = null;
              return;
            }
            console.log(`🔄 [Realtime] Backup poll ${pollCount}/40...`);
            fetchProgressState();
          }, 3000);

          // Store interval ref for cleanup
          recurringPollIntervalRef.current = pollInterval;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [Realtime] Connection issue, falling back to polling...');
          activateFallbackPolling();
        }
      });

    channelRef.current = channel;

    fallbackTimeoutRef.current = setTimeout(() => {
      if (isCleanedUpRef.current) return;

      console.error('⏱️ [Timeout] Processing exceeded 2 minutes');
      sonnerToast.error(
        '⏱️ Timeout: Xử lý quá lâu. Vui lòng kiểm tra chi tiết đơn hàng.',
        { id: toastId, duration: 5000 }
      );
      cleanup();
    }, 120000);

    return cleanup;
  }, [orderId, progressState.isComplete, toastId, debouncedFetchProgress, resetHeartbeatTimeout, activateFallbackPolling, cleanup]);

  return { progressState, isFallbackMode };
}
