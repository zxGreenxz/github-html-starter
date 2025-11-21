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
  skipInitialQuery?: boolean; // Skip if order just created (all items 'pending')
}

/**
 * Hook to monitor TPOS processing progress using Realtime subscriptions
 * with automatic fallback to polling if connection fails.
 *
 * Safety features:
 * - Debounced DB queries (300ms) to prevent query spam
 * - Heartbeat check (15s timeout) to detect stale connections
 * - Hard timeout (2 minutes) to prevent infinite waiting
 * - Auto-fallback to polling on connection issues
 * - Proper cleanup to prevent memory leaks
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
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const lastCompletedCountRef = useRef<number>(0);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const isCleanedUpRef = useRef(false);

  // ✅ SAFETY: Fetch current state from DB
  const fetchProgressState = useCallback(async () => {
    if (isCleanedUpRef.current) return;

    try {
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('tpos_sync_status')
        .eq('purchase_order_id', orderId);

      if (items && !isCleanedUpRef.current) {
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

        // Update toast (throttled to significant changes)
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

        // Check if complete
        if (isComplete) {
          handleCompletion({ successCount, failedCount, completedCount, totalItems, isComplete: true });
        }
      }
    } catch (error) {
      console.error('❌ [Realtime] Error fetching progress:', error);
    }
  }, [orderId, totalItems, toastId]);

  // ✅ DEBOUNCED: Re-query to prevent spam (300ms silence window)
  const debouncedFetchProgress = useCallback(() => {
    if (queryDebounceTimeoutRef.current) {
      clearTimeout(queryDebounceTimeoutRef.current);
    }

    queryDebounceTimeoutRef.current = setTimeout(() => {
      fetchProgressState();
    }, 300);
  }, [fetchProgressState]);

  // ✅ COMPLETION: Handle completion logic
  const handleCompletion = useCallback((state: ProgressState) => {
    if (isCleanedUpRef.current) return;

    console.log('✅ [Realtime] Processing complete:', state);

    const { successCount, failedCount } = state;

    // Show final result toast
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

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["products-select"] });

    // Call completion callback
    onComplete(state);

    // Cleanup
    cleanup();
  }, [toastId, queryClient, onComplete]);

  // ✅ HEARTBEAT: Detect stale connections (15s timeout)
  const startHeartbeatCheck = useCallback(() => {
    const checkHeartbeat = () => {
      if (isCleanedUpRef.current || progressState.isComplete) return;

      const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;

      // No updates for 15 seconds → fallback to polling
      if (timeSinceLastUpdate > 15000 && !progressState.isComplete && !isFallbackMode) {
        console.warn('💔 [Realtime] No updates for 15s, falling back to polling...');
        activateFallbackPolling();
      } else if (!isCleanedUpRef.current && !progressState.isComplete) {
        // Check again in 10s
        heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 10000);
      }
    };

    heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 10000);
  }, [progressState.isComplete, isFallbackMode]);

  const resetHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    startHeartbeatCheck();
  }, [startHeartbeatCheck]);

  // ✅ FALLBACK: Polling mechanism (if Realtime fails)
  const activateFallbackPolling = useCallback(() => {
    if (isFallbackMode || progressState.isComplete || isCleanedUpRef.current) return;

    console.log('🔄 [Fallback] Activating polling mode...');
    setIsFallbackMode(true);

    let pollInterval = 2000;
    let pollCount = 0;
    const MAX_POLLS = 60;

    const poll = async () => {
      if (pollCount++ >= MAX_POLLS || progressState.isComplete || isCleanedUpRef.current) {
        return;
      }

      await fetchProgressState();

      if (!progressState.isComplete && !isCleanedUpRef.current) {
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [isFallbackMode, progressState.isComplete, fetchProgressState]);

  // ✅ CLEANUP: Prevent memory leaks
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
  }, []);

  // ✅ INITIAL: Fetch initial state on mount
  useEffect(() => {
    // Skip if no orderId (not active)
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
    // Skip if no orderId (not active) or already complete
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

          // Reset heartbeat timeout
          lastUpdateTimeRef.current = Date.now();
          resetHeartbeatTimeout();

          // Debounced re-query (prevents spam when multiple items update)
          debouncedFetchProgress();
        }
      )
      .subscribe((status) => {
        if (isCleanedUpRef.current) return;

        console.log('🔴 [Realtime] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Connected successfully');
          setIsFallbackMode(false);
          startHeartbeatCheck();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [Realtime] Connection issue, falling back to polling...');
          activateFallbackPolling();
        }
      });

    channelRef.current = channel;

    // ✅ SAFETY: 2-minute hard timeout
    fallbackTimeoutRef.current = setTimeout(() => {
      if (isCleanedUpRef.current) return;

      console.error('⏱️ [Timeout] Processing exceeded 2 minutes');
      sonnerToast.error(
        '⏱️ Timeout: Xử lý quá lâu. Vui lòng kiểm tra chi tiết đơn hàng.',
        { id: toastId, duration: 5000 }
      );
      cleanup();
    }, 120000); // 2 minutes

    return cleanup;
  }, [orderId, progressState.isComplete, toastId, debouncedFetchProgress, resetHeartbeatTimeout, startHeartbeatCheck, activateFallbackPolling, cleanup]);

  return { progressState, isFallbackMode };
}
