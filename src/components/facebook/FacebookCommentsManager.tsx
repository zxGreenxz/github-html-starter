import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Video,
  MessageCircle,
  Heart,
  RefreshCw,
  Pause,
  Play,
  Search,
  Loader2,
  Facebook,
  ChevronDown,
  Copy,
  Maximize,
  AlertCircle,
  Minimize,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type {
  FacebookVideo,
  FacebookComment,
  CommentWithStatus,
  TPOSOrder,
} from "@/types/facebook";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FacebookCommentArchive {
  facebook_comment_id: string;
  facebook_post_id: string;
  facebook_user_id: string;
  facebook_user_name: string;
  comment_message: string;
  comment_created_time: string;
  like_count: number;
}

interface CustomerRecord {
  facebook_id: string;
  customer_name: string;
  phone: string | null;
  customer_status: string;
  info_status: "complete" | "incomplete";
}

interface StatusMapEntry {
  partnerStatus?: string;
  orderInfo?: TPOSOrder;
  isLoadingStatus?: boolean;
}

interface FacebookCommentsManagerProps {
  onVideoSelected?: (
    pageId: string,
    videoId: string,
    video: FacebookVideo | null,
  ) => void;
}


// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  PAGE_ID: "liveProducts_commentsPageId",
  SELECTED_VIDEO: "liveProducts_selectedFacebookVideo",
  VIDEO_ID: "liveProducts_commentsVideoId",
} as const;

const DEFAULT_HIDE_NAMES = ["Nhi Judy House"];
const REALTIME_CHECK_INTERVAL = 5000; // 5 seconds
const DEBOUNCE_DELAY = 100;
const FETCH_LIMIT = 500;
const ORDERS_TOP = 200;

// ============================================================================
// CACHE HELPER
// ============================================================================

const getCommentsQueryKey = (
  pageId: string | null, 
  videoId: string | null, 
  isLive: boolean
) => {
  const cacheType = isLive ? "live" : "offline";
  return ["facebook-comments", cacheType, pageId, videoId];
};

const STATUS_MAP: Record<string, string> = {
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
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function safeLocalStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error(`Failed to get ${key} from localStorage:`, error);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error(`Failed to set ${key} in localStorage:`, error);
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove ${key} from localStorage:`, error);
      }
    },
  };
}

function mapStatusText(statusText: string | null | undefined): string {
  if (!statusText) return "Bình thường";
  const normalizedStatus = statusText.trim().toLowerCase();
  return STATUS_MAP[normalizedStatus] || "Bình thường";
}

function parseJSONSafely<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return fallback;
  }
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const storage = safeLocalStorage();

  const [state, setState] = useState<T>(() => {
    const saved = storage.getItem(key);
    if (saved === null) return initialValue;

    if (typeof initialValue === "string") {
      return saved as T;
    }

    return parseJSONSafely(saved, initialValue);
  });

  useEffect(() => {
    if (typeof state === "string") {
      storage.setItem(key, state);
    } else {
      storage.setItem(key, JSON.stringify(state));
    }
  }, [key, state, storage]);

  return [state, setState];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FacebookCommentsManager({
  onVideoSelected,
}: FacebookCommentsManagerProps = {}) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [pageId, setPageId] = usePersistedState(STORAGE_KEYS.PAGE_ID, "");
  const [limit, setLimit] = useState("1");
  const [selectedVideo, setSelectedVideo] =
    usePersistedState<FacebookVideo | null>(STORAGE_KEYS.SELECTED_VIDEO, null);

  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(
    null,
  );
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [customerStatusMap, setCustomerStatusMap] = useState<
    Map<string, StatusMapEntry>
  >(new Map());
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const [showOnlyWithOrders, setShowOnlyWithOrders] = useState(false);
  const [hideNames, setHideNames] = useState<string[]>(DEFAULT_HIDE_NAMES);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(
    new Set(),
  );

  // ============================================================================
  // REFS
  // ============================================================================

  const scrollRef = useRef<HTMLDivElement>(null);
  const allCommentIdsRef = useRef<Set<string>>(new Set());
  const fetchInProgress = useRef(false);
  const customerStatusMapRef = useRef<Map<string, StatusMapEntry>>(new Map());
  const isCheckingNewCommentsRef = useRef(false);
  const fetchedNonLiveVideosRef = useRef<Set<string>>(new Set());
  const pendingInvalidationRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCommentsRef = useRef<Set<string>>(new Set());
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Fetch Facebook pages
  const { data: facebookPages } = useQuery({
    queryKey: ["facebook-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const selectedPage = facebookPages?.find((p) => p.page_id === pageId);

  // Fetch videos
  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
    error: videosErrorMessage,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: ["facebook-videos", pageId, limit],
    queryFn: async () => {
      const { queryWithAutoRefresh } = await import('@/lib/query-with-auto-refresh');
      
      return queryWithAutoRefresh(async () => {
        if (!pageId) return [];

        console.log(`[Videos] 🎬 Fetching videos for pageId: ${pageId}, limit: ${limit}`);
        
        const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-livevideo?pageId=${pageId}&limit=${limit}`;
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Videos] ❌ Error ${response.status}:`, errorData);
          throw new Error(errorData.error || errorData.details || `Failed to fetch videos (${response.status})`);
        }

        const result = await response.json();
        const videosArray = (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
        console.log(`[Videos] ✅ Fetched ${videosArray.length} videos`);
        return videosArray;
      }, 'facebook');
    },
    enabled: !!pageId,
    retry: 1,
  });

  // Fetch comments with infinite scroll
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchComments,
    isLoading: commentsLoading,
  } = useInfiniteQuery({
    queryKey: getCommentsQueryKey(
      pageId, 
      selectedVideo?.objectId, 
      selectedVideo?.statusLive === 1
    ),
    queryFn: async ({ pageParam }) => {
      const { queryWithAutoRefresh } = await import('@/lib/query-with-auto-refresh');
      
      return queryWithAutoRefresh(async () => {
        const fetchId = Math.random().toString(36).substring(7);
        if (!pageId || !selectedVideo?.objectId) return { data: [], paging: {} };

        console.log(`[QueryFn ${fetchId}] 🔍 Fetching comments`, {
          videoId: selectedVideo.objectId,
          pageId,
          timestamp: new Date().toISOString()
        });
        const startTime = Date.now();

        // ========================================================================
        // READ FROM facebook_comments_archive (NOT from TPOS directly)
        // ========================================================================

        const { data: archivedComments, error: dbError } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*')
          .eq('facebook_post_id', selectedVideo.objectId)
          .order('comment_created_time', { ascending: false })
          .limit(1000);

        if (dbError) {
          console.error(`[QueryFn ${fetchId}] ❌ DB error:`, dbError);
          return { data: [], paging: {} };
        }

        // 🔥 Deduplicate comments by ID to prevent duplicate display
        console.log(`[QueryFn ${fetchId}] 🔄 Deduplicating ${archivedComments?.length || 0} comments`);
        const seenIds = new Set<string>();
        const formattedComments = archivedComments?.reduce((acc: any[], c: any) => {
          if (!seenIds.has(c.facebook_comment_id)) {
            seenIds.add(c.facebook_comment_id);
            acc.push({
              id: c.facebook_comment_id,
              message: c.comment_message || '',
              from: {
                name: c.facebook_user_name || 'Unknown',
                id: c.facebook_user_id || '',
              },
              created_time: c.comment_created_time,
              like_count: c.like_count || 0,
              is_deleted_by_tpos: c.is_deleted_by_tpos || false,
              deleted_at: c.updated_at,
            });
          } else {
            console.log(`[QueryFn ${fetchId}] ⚠️ Skipped duplicate: ${c.facebook_comment_id}`);
          }
          return acc;
        }, []) || [];

        const elapsed = Date.now() - startTime;
        console.log(`[QueryFn ${fetchId}] ✅ Fetched`, {
          uniqueCount: formattedComments.length,
          totalCount: archivedComments?.length,
          firstCommentId: formattedComments[0]?.id,
          lastCommentId: formattedComments[formattedComments.length - 1]?.id,
          elapsed: `${elapsed}ms`
        });

        return { 
          data: formattedComments, 
          paging: {},
          fromArchive: true 
        };
      }, 'facebook');
    },
    getNextPageParam: () => undefined, // No pagination needed for archive
    initialPageParam: undefined,
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: false, // Disable auto-refetch, rely on invalidation only
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 0, // Always consider data stale to allow immediate refetch
  });

  // Cache orders data
  const { data: ordersData = [] } = useQuery({
    queryKey: ["tpos-orders", selectedVideo?.objectId],
    queryFn: async () => {
      if (!selectedVideo?.objectId) return [];

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const ordersResponse = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-facebook-orders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            postId: selectedVideo.objectId,
            top: ORDERS_TOP,
          }),
        },
      );

      if (!ordersResponse.ok) return [];

      const ordersDataResult = await ordersResponse.json();
      return ordersDataResult.value || [];
    },
    enabled: !!selectedVideo?.objectId,
    staleTime: 5 * 60 * 1000,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const createOrderMutation = useMutation({
    mutationFn: async ({
      comment,
      video,
      commentType = "hang_dat",
    }: {
      comment: FacebookComment;
      video: FacebookVideo;
      commentType?: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-tpos-order-from-comment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment, video, commentType }),
        },
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(responseData));
      }

      return responseData;
    },
    onMutate: (variables) => {
      setPendingCommentIds((prev) => new Set(prev).add(variables.comment.id));
    },
    onSuccess: (data) => {
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
    },
    onError: (error: Error) => {
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch (e) {
        errorData = { error: error.message };
      }

      toast({
        title: "Lỗi tạo đơn hàng",
        description: errorData.error || "Có lỗi không xác định",
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      setPendingCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.comment.id);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ["tpos-orders", selectedVideo?.objectId],
      });
      queryClient.invalidateQueries({
        queryKey: getCommentsQueryKey(
          pageId, 
          selectedVideo?.objectId, 
          selectedVideo?.statusLive === 1
        ),
      });
    },
  });


  // ============================================================================
  // CLEAR OPPOSITE CACHE WHEN VIDEO CHANGES
  // ============================================================================

  useEffect(() => {
    if (selectedVideo) {
      // Clear cache của trạng thái khác
      const isLive = selectedVideo.statusLive === 1;
      const oppositeCacheKey = getCommentsQueryKey(
        pageId,
        selectedVideo.objectId,
        !isLive // Clear cache của trạng thái ngược lại
      );
      queryClient.removeQueries({ queryKey: oppositeCacheKey });
      
      console.log(`[Cache] Cleared ${isLive ? 'offline' : 'live'} cache for video ${selectedVideo.objectId}`);
    }
  }, [selectedVideo?.objectId, selectedVideo?.statusLive]);

  // ============================================================================
  // REALTIME CHECK FOR NEW COMMENTS (calls Edge Function to process)
  // ============================================================================

  useEffect(() => {
    // Cleanup previous interval
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }

    if (
      !selectedVideo ||
      !pageId ||
      !isAutoRefresh ||
      selectedVideo.statusLive !== 1
    ) {
      return;
    }

    const checkForNewComments = async () => {
      if (isCheckingNewCommentsRef.current) return;
      isCheckingNewCommentsRef.current = true;

      try {
        console.log(`[Realtime Check] Calling Edge Function to process comments for video ${selectedVideo.objectId}`);
        
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const sessionIndex = selectedVideo.objectId;
        
        // Call Edge Function to fetch from TPOS and push to archive
        const response = await fetch(
          `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&sessionIndex=${sessionIndex}&limit=500`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        const result = await response.json();
        
        console.log(`[Realtime Check] ✅ Edge Function completed`, {
          newComments: result?.comments?.length || 0,
          status: response.status
        });
        
        // 🔥 FALLBACK: Invalidate query if new comments are returned
        // This ensures UI updates even if Postgres Realtime doesn't trigger
        if (result?.comments?.length > 0) {
          console.log(`[Realtime Check] 🔄 Fallback invalidating query (${result.comments.length} new comments)`);
          
          queryClient.invalidateQueries({
            queryKey: getCommentsQueryKey(
              pageId,
              selectedVideo.objectId,
              selectedVideo.statusLive === 1
            ),
          });
        }
      } catch (error) {
        console.error("[Realtime Check] Error:", error);
      } finally {
        isCheckingNewCommentsRef.current = false;
      }
    };

    // Set up interval
    realtimeIntervalRef.current = setInterval(
      checkForNewComments,
      REALTIME_CHECK_INTERVAL,
    );

    // Cleanup
    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
        realtimeIntervalRef.current = null;
      }
    };
  }, [selectedVideo, pageId, isAutoRefresh, queryClient, toast]);

  // ============================================================================
  // REALTIME SUBSCRIPTION TO facebook_comments_archive
  // ============================================================================

  useEffect(() => {
    if (!selectedVideo?.objectId || !pageId) return;

    const channel = supabase
      .channel(`facebook-archive-${selectedVideo.objectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'facebook_comments_archive',
          filter: `facebook_post_id=eq.${selectedVideo.objectId}`,
        },
        async (payload) => {
          const timestamp = new Date().toISOString();
          const newComment = payload.new as any;
          
          console.log(`[${timestamp}] 🔥 Realtime trigger received:`, {
            event: payload.eventType,
            comment_id: newComment?.facebook_comment_id,
            message: newComment?.comment_message?.substring(0, 50),
            table: 'facebook_comments_archive'
          });

          // Track new comments for batching
          if (payload.eventType === 'INSERT' && newComment?.facebook_comment_id) {
            pendingCommentsRef.current.add(newComment.facebook_comment_id);
          }

          // Clear existing timer
          if (pendingInvalidationRef.current) {
            clearTimeout(pendingInvalidationRef.current);
          }

          // Debounce: Wait 500ms after last event before invalidating
          pendingInvalidationRef.current = setTimeout(async () => {
            try {
              const isLive = selectedVideo.statusLive === 1;
              const queryKey = getCommentsQueryKey(pageId, selectedVideo.objectId, isLive);
              
              const pendingCount = pendingCommentsRef.current.size;
              
              console.log(`[${new Date().toISOString()}] 🔑 Batch invalidating query:`, {
                queryKey,
                pendingNewComments: pendingCount,
                isLive,
                pageId,
                videoId: selectedVideo.objectId
              });
              
              // Invalidate and force refetch
              queryClient.invalidateQueries({ queryKey });
              await queryClient.refetchQueries({ 
                queryKey,
                exact: true,
                type: 'active'
              });
              
              console.log(`[${new Date().toISOString()}] ✅ Query invalidated + refetched (${pendingCount} new comments)`);
              
              // Clear pending set
              pendingCommentsRef.current.clear();
            } catch (error) {
              console.error(`[${new Date().toISOString()}] ❌ Error:`, error);
            }
          }, 500); // Wait 500ms after last event
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facebook_pending_orders',
          filter: `facebook_post_id=eq.${selectedVideo.objectId}`,
        },
        (payload) => {
          console.log('[Realtime] facebook_pending_orders change:', payload);
          queryClient.invalidateQueries({ queryKey: ['tpos-orders', selectedVideo.objectId] });
        }
      )
      .subscribe();

    return () => {
      if (pendingInvalidationRef.current) {
        clearTimeout(pendingInvalidationRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [selectedVideo?.objectId, pageId, queryClient]);

  // ============================================================================
  // PROCESS COMMENTS
  // ============================================================================

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap((page) => page.data) || [];
    const uniqueComments = new Map<string, FacebookComment>();
    allComments.forEach((comment) => {
      uniqueComments.set(comment.id, comment);
    });
    return Array.from(uniqueComments.values());
  }, [commentsData]);

  // ============================================================================
  // FETCH PARTNER STATUS
  // ============================================================================

  const fetchPartnerStatusBatch = useCallback(
    async (commentsToProcess: FacebookComment[], orders: TPOSOrder[]) => {
      if (fetchInProgress.current || commentsToProcess.length === 0) return;

      fetchInProgress.current = true;
      setIsLoadingCustomerStatus(true);

      try {
        const facebookIdsToFetch = [
          ...new Set(
            commentsToProcess
              .map((c) => c.from.id)
              .filter((id) => id && !customerStatusMapRef.current.has(id)),
          ),
        ];

        if (facebookIdsToFetch.length === 0) {
          return;
        }

        // Create user-order map
        const userOrderMap = new Map<string, TPOSOrder>();
        for (const order of orders) {
          if (
            order.Facebook_ASUserId &&
            !userOrderMap.has(order.Facebook_ASUserId)
          ) {
            userOrderMap.set(order.Facebook_ASUserId, order);
          }
        }

        // Fetch existing customers
        const { data: existingCustomers = [], error: customerError } =
          await supabase
            .from("customers")
            .select("*")
            .in("facebook_id", facebookIdsToFetch)
            .returns<CustomerRecord[]>();

        if (customerError) {
          throw customerError;
        }

        const existingCustomersMap = new Map(
          existingCustomers.map((c) => [c.facebook_id, c]),
        );

        // Prepare batch upsert
        const customersToUpsert: Partial<CustomerRecord>[] = [];
        const newStatusMap = new Map(customerStatusMapRef.current);

        for (const facebookId of facebookIdsToFetch) {
          const order = userOrderMap.get(facebookId);
          const existingCustomer = existingCustomersMap.get(facebookId);
          const commentAuthorName =
            commentsToProcess.find((c) => c.from.id === facebookId)?.from
              .name || "Unknown";

          let partnerStatus: string;
          let customerDataForUpsert: Partial<CustomerRecord> | null = null;

          if (order && order.Telephone) {
            // Has order with phone
            partnerStatus = mapStatusText(
              existingCustomer?.customer_status || order.PartnerStatusText,
            );
            customerDataForUpsert = {
              facebook_id: facebookId,
              customer_name: order.Name || commentAuthorName,
              phone: order.Telephone,
              customer_status: partnerStatus,
              info_status: "complete",
            };
          } else if (existingCustomer) {
            // Exists in DB but no order
            partnerStatus = mapStatusText(existingCustomer.customer_status);
            if (
              !existingCustomer.phone ||
              existingCustomer.info_status === "incomplete"
            ) {
              partnerStatus = "Cần thêm TT";
            }
          } else {
            // New user
            partnerStatus = "Khách lạ";
            customerDataForUpsert = {
              facebook_id: facebookId,
              customer_name: commentAuthorName,
              phone: null,
              customer_status: "Bình thường",
              info_status: "incomplete",
            };
          }

          if (customerDataForUpsert) {
            customersToUpsert.push(customerDataForUpsert);
          }

          newStatusMap.set(facebookId, {
            partnerStatus,
            orderInfo: order,
            isLoadingStatus: false,
          });
        }

        // Upsert to DB
        if (customersToUpsert.length > 0) {
          const validCustomers = customersToUpsert
            .filter((c) => c.customer_name) // Only include customers with names
            .map((c) => ({
              ...c,
              customer_name: c.customer_name!,
            }));

          if (validCustomers.length > 0) {
            const { error: upsertError } = await supabase
              .from("customers")
              .upsert(validCustomers, {
                onConflict: "facebook_id",
                ignoreDuplicates: false,
              });

            if (upsertError) {
              throw upsertError;
            }
          }
        }

        // Update state
        customerStatusMapRef.current = newStatusMap;
        setCustomerStatusMap(newStatusMap);
      } catch (error) {
        console.error("Error fetching partner status:", error);
        toast({
          title: "Lỗi khi tải thông tin khách hàng",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        fetchInProgress.current = false;
        setIsLoadingCustomerStatus(false);
      }
    },
    [toast],
  );

  const debouncedFetchStatus = useMemo(
    () => debounce(fetchPartnerStatusBatch, DEBOUNCE_DELAY),
    [fetchPartnerStatusBatch],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup
    };
  }, []);

  useEffect(() => {
    if (!comments.length || !ordersData.length) return;

    const commentsNeedingStatus = comments.filter(
      (c) => !customerStatusMapRef.current.has(c.from.id),
    );

    if (commentsNeedingStatus.length > 0) {
      debouncedFetchStatus(commentsNeedingStatus, ordersData);
    }
  }, [comments, ordersData, debouncedFetchStatus]);

  // ============================================================================
  // COMPUTE COMMENTS WITH STATUS
  // ============================================================================

  const commentsWithStatus = useMemo((): CommentWithStatus[] => {
    return comments.map((comment) => {
      const status = customerStatusMap.get(comment.from.id);

      return {
        ...comment,
        partnerStatus: status?.partnerStatus,
        orderInfo: status?.orderInfo,
        isLoadingStatus: status?.isLoadingStatus,
      };
    });
  }, [comments, customerStatusMap]);

  // ============================================================================
  // DETECT NEW COMMENTS
  // ============================================================================

  useEffect(() => {
    if (comments.length === 0) {
      allCommentIdsRef.current = new Set();
      return;
    }

    const currentIds = new Set(comments.map((c) => c.id));
    const previousIds = allCommentIdsRef.current;

    const newIds = new Set<string>();
    currentIds.forEach((id) => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });

    if (newIds.size > 0 && previousIds.size > 0) {
      setNewCommentIds(newIds);
      toast({
        title: `🔔 ${newIds.size} comment mới!`,
      });

      if (newIds.size < 20 && scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }

      const timer = setTimeout(() => {
        setNewCommentIds(new Set());
      }, 3000);

      return () => clearTimeout(timer);
    }

    allCommentIdsRef.current = currentIds;
  }, [comments, toast]);

  // ============================================================================
  // FILTERED COMMENTS WITH OPTIMIZED SEARCH
  // ============================================================================

  const searchQueryLower = useMemo(
    () => searchQuery.toLowerCase(),
    [searchQuery],
  );

  const filteredComments = useMemo(() => {
    return commentsWithStatus.filter((comment) => {
      // Search filter
      if (searchQuery) {
        const messageLower = comment.message?.toLowerCase() || "";
        const nameLower = comment.from?.name?.toLowerCase() || "";

        if (
          !messageLower.includes(searchQueryLower) &&
          !nameLower.includes(searchQueryLower)
        ) {
          return false;
        }
      }

      // Order filter
      if (
        showOnlyWithOrders &&
        (!comment.orderInfo || !comment.orderInfo.Code)
      ) {
        return false;
      }

      // Hide names filter
      if (hideNames.includes(comment.from?.name || "")) {
        return false;
      }

      return true;
    });
  }, [
    commentsWithStatus,
    searchQuery,
    searchQueryLower,
    showOnlyWithOrders,
    hideNames,
  ]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLoadVideos = async () => {
    if (!pageId) {
      toast({
        title: "Vui lòng nhập Page ID",
        variant: "destructive",
      });
      return;
    }

    try {
      await refetchVideos();
      toast({
        title: "Đã tải videos thành công!",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi khi tải videos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVideoClick = (video: FacebookVideo) => {
    setSelectedVideo(video);
    safeLocalStorage().setItem(STORAGE_KEYS.VIDEO_ID, video.objectId);

    if (onVideoSelected) {
      onVideoSelected(pageId, video.objectId, video);
    }

    // Reset state
    allCommentIdsRef.current = new Set();
    setNewCommentIds(new Set());
    setSearchQuery("");

    // Clear customer status map for new video
    customerStatusMapRef.current = new Map();
    setCustomerStatusMap(new Map());
  };

  // First-time fetch for non-live videos
  useEffect(() => {
    if (!selectedVideo || !pageId) return;
    
    // Only handle non-live videos
    if (selectedVideo.statusLive === 1) return;
    
    // Skip if already fetched this video in this session
    if (fetchedNonLiveVideosRef.current.has(selectedVideo.objectId)) {
      console.log(`[Non-Live Video] Already fetched comments for ${selectedVideo.objectId}, skipping`);
      return;
    }
    
    // For non-live videos, fetch comments once from TPOS on first selection
    const fetchCommentsOnce = async () => {
      try {
        console.log(`[Non-Live Video] Fetching comments for ${selectedVideo.objectId}...`);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&sessionIndex=${selectedVideo.objectId}&limit=500`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge function returned ${response.status}: ${errorText}`);
        }
        
        // Mark as fetched
        fetchedNonLiveVideosRef.current.add(selectedVideo.objectId);
        console.log(`[Non-Live Video] ✅ Comments saved to archive`);
      } catch (error) {
        console.error('[Non-Live Video] Error fetching comments:', error);
      }
    };
    
    fetchCommentsOnce();
  }, [selectedVideo?.objectId, selectedVideo?.statusLive, pageId]);

  const handleShowInfo = (orderInfo: TPOSOrder | undefined) => {
    if (orderInfo) {
      setSelectedOrderInfo(orderInfo);
      setIsInfoDialogOpen(true);
    } else {
      toast({
        title: "Chưa có thông tin đơn hàng",
        variant: "destructive",
      });
    }
  };

  const handleCreateOrderClick = (comment: CommentWithStatus, commentType: "hang_dat" | "hang_le" = "hang_dat") => {
    if (selectedVideo) {
      createOrderMutation.mutate({ comment, video: selectedVideo, commentType });
    }
  };

  const handleRefreshFromTPOS = () => {
    queryClient.removeQueries({
      queryKey: getCommentsQueryKey(
        pageId, 
        selectedVideo?.objectId, 
        selectedVideo?.statusLive === 1
      ),
    });
    refetchComments();
    toast({
      title: "Đang làm mới",
      description: "Đang tải lại comments từ TPOS...",
    });
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const stats = useMemo(
    () => ({
      totalVideos: videos.length,
      liveVideos: videos.filter((v) => v.statusLive === 1).length,
      totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
      totalReactions: videos.reduce(
        (sum, v) => sum + (v.countReaction || 0),
        0,
      ),
    }),
    [videos],
  );

  const allCommentsLoaded = useMemo(() => {
    if (!selectedVideo || selectedVideo.statusLive === 1) return false;
    return commentsWithStatus.length >= selectedVideo.countComment;
  }, [commentsWithStatus, selectedVideo]);

  // ============================================================================
  // CLEANUP ON UNMOUNT
  // ============================================================================

  useEffect(() => {
    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={cn("flex-1 overflow-auto", isMobile ? "p-2" : "p-4")}>
        <div className="space-y-4">
          {/* Video List */}
          {!selectedVideo && (
            <Card className="border-0 shadow-sm">
              <CardHeader className={isMobile ? "pb-2" : "pb-3"}>
                <CardTitle className={isMobile ? "text-sm" : "text-base"}>
                  Cấu hình và Videos
                </CardTitle>
                <CardDescription className={isMobile ? "text-xs" : "text-sm"}>
                  Chọn Facebook Page từ danh sách đã thêm ở trên
                </CardDescription>
              </CardHeader>

              <CardContent className={cn("space-y-4", isMobile && "space-y-3")}>
                {/* Empty State: No Pages */}
                {(!facebookPages || facebookPages.length === 0) && (
                  <Alert className="border-orange-500/30 bg-orange-500/5">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-sm text-orange-700">
                      <div className="space-y-2">
                        <p className="font-medium">Chưa có Facebook Page nào</p>
                        <p>Vui lòng thêm Facebook Page ở tab "Facebook Page" ở trên để bắt đầu.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error State: Videos failed to load */}
                {videosError && (
                  <Alert className="border-destructive/30 bg-destructive/5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm text-destructive">
                      <div className="space-y-2">
                        <p className="font-medium">Không thể tải videos</p>
                        <p>{videosErrorMessage?.message || "Lỗi không xác định"}</p>
                        <p className="text-xs">
                          Có thể do: Facebook Bearer Token không tồn tại hoặc đã hết hạn. 
                          Vui lòng kiểm tra cài đặt TPOS credentials.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchVideos()}
                          className="mt-2"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Thử lại
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {selectedPage && selectedPage.crm_team_id && (
                  <div
                    className={cn(
                      "p-3 bg-muted rounded-md space-y-1",
                      isMobile ? "text-xs" : "text-sm",
                    )}
                  >
                    <div>
                      <span className="font-medium">Page:</span>{" "}
                      {selectedPage.page_name}
                    </div>
                    <div>
                      <span className="font-medium">CRM Team:</span>{" "}
                      {selectedPage.crm_team_name} ({selectedPage.crm_team_id})
                    </div>
                  </div>
                )}

                <div className={cn("flex gap-4", isMobile && "flex-col gap-2")}>
                  <div className="flex-1">
                    <Select value={pageId} onValueChange={setPageId}>
                      <SelectTrigger className={isMobile ? "h-9 text-xs" : ""}>
                        <SelectValue placeholder="Chọn fanpage" />
                      </SelectTrigger>
                      <SelectContent>
                        {facebookPages && facebookPages.length > 0 ? (
                          facebookPages.map((page) => (
                            <SelectItem key={page.id} value={page.page_id}>
                              {page.page_name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Chưa có page nào. Thêm ở tab trên.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={cn(isMobile ? "w-full" : "w-32")}>
                    <Input
                      type="number"
                      placeholder="Limit"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      min="1"
                      max="50"
                      className={isMobile ? "h-9 text-xs" : ""}
                      aria-label="Số lượng video tối đa"
                    />
                  </div>

                  <Button
                    onClick={handleLoadVideos}
                    disabled={videosLoading}
                    size={isMobile ? "sm" : "default"}
                    className={isMobile ? "w-full" : ""}
                    aria-label="Tải videos từ Facebook"
                  >
                    {videosLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang tải...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Tải Videos
                      </>
                    )}
                  </Button>
                </div>

                {/* Empty State: No videos found */}
                {!videosLoading && !videosError && videos.length === 0 && pageId && (
                  <Alert className="border-blue-500/30 bg-blue-500/5">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-700">
                      <div className="space-y-2">
                        <p className="font-medium">Không tìm thấy video nào</p>
                        <p>Page này chưa có video nào hoặc không có video trong {limit} video gần nhất.</p>
                        <p className="text-xs">Thử tăng limit hoặc kiểm tra lại page.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {videos.length > 0 && (
                  <div
                    className={cn(
                      "grid gap-4",
                      isMobile
                        ? "grid-cols-2 gap-2"
                        : "grid-cols-2 md:grid-cols-4",
                    )}
                  >
                    <Card>
                      <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                        <div className="text-center">
                          <Video
                            className={cn(
                              "mx-auto mb-2 text-primary",
                              isMobile ? "h-6 w-6" : "h-8 w-8",
                            )}
                            aria-hidden="true"
                          />
                          <div
                            className={cn(
                              "font-bold",
                              isMobile ? "text-lg" : "text-2xl",
                            )}
                          >
                            {stats.totalVideos}
                          </div>
                          <div
                            className={cn(
                              "text-muted-foreground",
                              isMobile ? "text-xs" : "text-sm",
                            )}
                          >
                            Videos
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                        <div className="text-center">
                          <Badge
                            variant="destructive"
                            className={cn("mb-2", isMobile && "text-xs")}
                          >
                            LIVE
                          </Badge>
                          <div
                            className={cn(
                              "font-bold",
                              isMobile ? "text-lg" : "text-2xl",
                            )}
                          >
                            {stats.liveVideos}
                          </div>
                          <div
                            className={cn(
                              "text-muted-foreground",
                              isMobile ? "text-xs" : "text-sm",
                            )}
                          >
                            Đang Live
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                        <div className="text-center">
                          <MessageCircle
                            className={cn(
                              "mx-auto mb-2 text-blue-500",
                              isMobile ? "h-6 w-6" : "h-8 w-8",
                            )}
                            aria-hidden="true"
                          />
                          <div
                            className={cn(
                              "font-bold",
                              isMobile ? "text-lg" : "text-2xl",
                            )}
                          >
                            {stats.totalComments.toLocaleString()}
                          </div>
                          <div
                            className={cn(
                              "text-muted-foreground",
                              isMobile ? "text-xs" : "text-sm",
                            )}
                          >
                            Comments
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                        <div className="text-center">
                          <Heart
                            className={cn(
                              "mx-auto mb-2 text-red-500",
                              isMobile ? "h-6 w-6" : "h-8 w-8",
                            )}
                            aria-hidden="true"
                          />
                          <div
                            className={cn(
                              "font-bold",
                              isMobile ? "text-lg" : "text-2xl",
                            )}
                          >
                            {stats.totalReactions.toLocaleString()}
                          </div>
                          <div
                            className={cn(
                              "text-muted-foreground",
                              isMobile ? "text-xs" : "text-sm",
                            )}
                          >
                            Reactions
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Video Grid */}
          {videos.length > 0 && !selectedVideo && (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {videos.map((video) => (
                  <Card
                    key={video.objectId}
                    className={cn(
                      "cursor-pointer hover:shadow-lg transition-all overflow-hidden",
                      selectedVideo?.objectId === video.objectId &&
                        "border-primary border-2",
                    )}
                    onClick={() => handleVideoClick(video)}
                  >
                    <div className="flex gap-3 p-3">
                      {/* Thumbnail nhỏ bên trái */}
                      <div className="relative w-32 h-20 bg-muted flex-shrink-0 rounded overflow-hidden">
                        {video.thumbnail?.url ? (
                          <img
                            src={video.thumbnail.url}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-6 w-6 text-muted-foreground opacity-30" />
                          </div>
                        )}
                        {video.statusLive === 1 && (
                          <Badge variant="destructive" className="absolute top-1 right-1 text-xs px-1.5 py-0">
                            🔴 LIVE
                          </Badge>
                        )}
                      </div>

                      {/* Info bên phải */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                          {video.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          {video.channelCreatedTime
                            ? format(new Date(video.channelCreatedTime), "dd/MM/yyyy HH:mm")
                            : "N/A"}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>{(video.countComment || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            <span>{(video.countReaction || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Comments Panel */}
          {selectedVideo ? (
            <Card
              className={cn(
                "border-0 shadow-sm transition-all duration-300",
                isMobile &&
                  isFullscreen &&
                  "fixed inset-0 z-50 rounded-none m-0",
              )}
            >
              <CardHeader
                className={cn("border-b", isMobile ? "py-2" : "py-3")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle
                      className={cn(
                        "line-clamp-1",
                        isMobile ? "text-sm" : "text-base",
                      )}
                    >
                      {selectedVideo.title}
                    </CardTitle>
                    <CardDescription
                      className={isMobile ? "text-xs" : "text-sm"}
                    >
                      Xem và theo dõi comments từ video
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedVideo.statusLive === 1 && (
                      <Badge
                        variant="destructive"
                        className={isMobile ? "text-xs" : ""}
                      >
                        🔴 LIVE
                      </Badge>
                    )}

                    {isMobile && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-7 px-2"
                        aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                      >
                        {isFullscreen ? (
                          <Minimize className="h-3.5 w-3.5" />
                        ) : (
                          <Maximize className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      onClick={() => {
                        setSelectedVideo(null);
                        setIsFullscreen(false);
                      }}
                      className={isMobile ? "text-xs h-7 px-2" : ""}
                      aria-label="Chọn video khác"
                    >
                      <Video
                        className={cn(isMobile ? "h-3 w-3" : "h-4 w-4 mr-2")}
                      />
                      {!isMobile && "Chọn video khác"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                    aria-label={
                      isAutoRefresh
                        ? "Tạm dừng tự động làm mới"
                        : "Tiếp tục tự động làm mới"
                    }
                  >
                    {isAutoRefresh ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshFromTPOS}
                    aria-label="Làm mới từ TPOS"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Làm mới từ TPOS
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchComments()}
                    aria-label="Làm mới comments"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>

                  {commentsData?.pages[0]?.fromArchive && (
                    <Badge variant="secondary" className="text-xs">
                      📦 From archive
                    </Badge>
                  )}

                  {newCommentIds.size > 0 && (
                    <Badge variant="default" className="ml-auto">
                      {newCommentIds.size} mới
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      placeholder="Tìm kiếm comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      aria-label="Tìm kiếm comments"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-only-with-orders"
                        checked={showOnlyWithOrders}
                        onCheckedChange={(checked) =>
                          setShowOnlyWithOrders(checked as boolean)
                        }
                        aria-label="Chỉ hiển thị comment có đơn"
                      />
                      <Label
                        htmlFor="show-only-with-orders"
                        className="text-sm font-medium whitespace-nowrap cursor-pointer"
                      >
                        Chỉ hiển thị comment có đơn
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hide-page-comments"
                        checked={hideNames.includes("Nhi Judy House")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHideNames(["Nhi Judy House"]);
                          } else {
                            setHideNames([]);
                          }
                        }}
                        aria-label="Ẩn comment từ Nhi Judy House"
                      />
                      <Label
                        htmlFor="hide-page-comments"
                        className="text-sm font-medium whitespace-nowrap cursor-pointer"
                      >
                        Ẩn "Nhi Judy House"
                      </Label>
                    </div>

                    <div className="text-sm text-muted-foreground ml-auto">
                      Hiển thị {filteredComments.length} /{" "}
                      {commentsWithStatus.length} comments
                    </div>
                  </div>
                </div>

                {/* Warning nhỏ khi có comment bị xóa */}
                {selectedVideo &&
                  commentsData?.pages[0]?.fromArchive && (
                    <Alert className="border-blue-500/30 bg-blue-500/5 mb-4">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-700">
                        ℹ️ Đang hiển thị từ archive. Comments được đồng bộ từ Facebook.
                      </AlertDescription>
                    </Alert>
                  )}

                <ScrollArea
                  className={cn(
                    isMobile && isFullscreen
                      ? "h-[calc(100vh-180px)]"
                      : "h-[500px]",
                    "pr-4",
                  )}
                  ref={scrollRef}
                >
                  <div className="space-y-4">
                    {commentsLoading && comments.length === 0 ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      </div>
                    ) : filteredComments.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        {searchQuery
                          ? "Không tìm thấy comment nào"
                          : "Chưa có comment"}
                      </div>
                    ) : (
                      filteredComments.map((comment) => {
                        const isNew = newCommentIds.has(comment.id);
                        const status = comment.partnerStatus || "Khách lạ";
                        const isDeleted = comment.is_deleted || false;

                        return (
                          <Card
                            key={comment.id}
                            className={cn(
                              isNew &&
                                "border-primary bg-primary/5 animate-in fade-in slide-in-from-bottom-2",
                              isDeleted && "border-red-300 bg-red-50/50 opacity-75",
                            )}
                          >
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-3">
                                <div className="relative flex-shrink-0">
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                                      comment.orderInfo?.SessionIndex
                                        ? "bg-red-500"
                                        : "bg-gradient-to-br from-primary to-primary/60",
                                    )}
                                  >
                                    {comment.orderInfo?.SessionIndex
                                      ? comment.orderInfo.SessionIndex
                                      : comment.from?.name?.charAt(0) || "?"}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant="default"
                                      className="text-xs font-semibold"
                                    >
                                      {comment.from?.name}
                                    </Badge>

                                    {comment.partnerStatus &&
                                      comment.partnerStatus !== "Khách lạ" &&
                                      comment.partnerStatus !== "Cần thêm TT" &&
                                      comment.partnerStatus !==
                                        "Bình thường" && (
                                        <Badge
                                          variant={
                                            comment.partnerStatus === "Cảnh báo"
                                              ? "secondary"
                                              : comment.partnerStatus ===
                                                    "Bom hàng" ||
                                                  comment.partnerStatus ===
                                                    "Nguy hiểm"
                                                ? "destructive"
                                                : "default"
                                          }
                                          className="text-xs"
                                        >
                                          {comment.partnerStatus}
                                        </Badge>
                                      )}

                                    {!isMobile &&
                                    comment.orderInfo?.Telephone ? (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {comment.orderInfo.Telephone}
                                      </Badge>
                                    ) : !comment.orderInfo?.Telephone &&
                                      comment.partnerStatus ===
                                        "Cần thêm TT" ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs bg-red-500/20 text-red-700"
                                      >
                                        Cần thêm TT
                                      </Badge>
                                    ) : !comment.orderInfo?.Telephone ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs bg-orange-500/20 text-orange-700"
                                      >
                                        Chưa có TT
                                      </Badge>
                                    ) : null}

                                    {isNew && (
                                      <Badge
                                        variant="default"
                                        className="text-xs"
                                      >
                                        ✨ MỚI
                                      </Badge>
                                    )}

                                    {isDeleted && (
                                      <Badge
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        ❌ Đã xóa
                                      </Badge>
                                    )}

                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {comment.created_time
                                        ? format(
                                            new Date(comment.created_time),
                                            isMobile
                                              ? "HH:mm"
                                              : "dd/MM/yyyy HH:mm",
                                          )
                                        : "N/A"}
                                    </span>
                                  </div>

                                  <p className={cn(
                                    "text-sm font-semibold whitespace-pre-wrap break-words mt-1.5",
                                    isDeleted && "text-muted-foreground line-through"
                                  )}>
                                    {comment.message}
                                  </p>

                                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        handleCreateOrderClick(comment)
                                      }
                                      disabled={pendingCommentIds.has(
                                        comment.id,
                                      ) || isDeleted}
                                      aria-label="Tạo đơn hàng"
                                    >
                                      {pendingCommentIds.has(comment.id) && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Tạo đơn hàng
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 text-xs"
                                      onClick={() => handleCreateOrderClick(comment, "hang_le")}
                                      disabled={pendingCommentIds.has(comment.id) || isDeleted}
                                      aria-label="Tạo đơn hàng lẻ"
                                    >
                                      {pendingCommentIds.has(comment.id) && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Hàng Lẻ
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        handleShowInfo(comment.orderInfo)
                                      }
                                      aria-label="Xem thông tin đơn hàng"
                                    >
                                      Thông tin
                                    </Button>

                                    {comment.like_count > 0 && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                        <Heart
                                          className="h-3 w-3"
                                          aria-hidden="true"
                                        />
                                        {comment.like_count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}

                    {allCommentsLoaded ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Đã tải tất cả bình luận.
                      </div>
                    ) : (
                      hasNextPage && (
                        <div className="text-center py-4">
                          <Button
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            variant="outline"
                            aria-label="Tải thêm bình luận"
                          >
                            {isFetchingNextPage && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Tải thêm bình luận
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </ScrollArea>

                <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                  {selectedVideo && selectedVideo.statusLive !== 1
                    ? `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments (Tổng: ${selectedVideo.countComment})`
                    : `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments (🔴 Live - Real-time)`}
                  {isAutoRefresh &&
                    selectedVideo.statusLive === 1 &&
                    " • Auto-refresh mỗi 5s"}
                  {commentsData?.pages[0]?.fromArchive &&
                    " • 📦 From archive"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent
                className={cn(
                  "flex flex-col items-center justify-center",
                  isMobile ? "py-8" : "py-12",
                )}
              >
                <MessageCircle
                  className={cn(
                    "text-muted-foreground/30 mb-4",
                    isMobile ? "h-12 w-12" : "h-16 w-16",
                  )}
                  aria-hidden="true"
                />
                <p
                  className={cn(
                    "font-medium text-muted-foreground",
                    isMobile ? "text-base" : "text-lg",
                  )}
                >
                  Chọn video để xem comments
                </p>
                <p
                  className={cn(
                    "text-muted-foreground/70 mt-2",
                    isMobile ? "text-xs" : "text-sm",
                  )}
                >
                  {videos.length > 0
                    ? `${videos.length} video có sẵn - Click để xem comment`
                    : "Tải videos từ Facebook page ở trên"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Order Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thông tin đơn hàng</DialogTitle>
            <DialogDescription>Chi tiết đơn hàng từ TPOS</DialogDescription>
          </DialogHeader>

          {selectedOrderInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Mã đơn</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.Code}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Trạng thái</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.StatusText}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Khách hàng</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.Name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.Telephone}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.PartnerName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner Status</label>
                  <Badge
                    variant={
                      selectedOrderInfo.PartnerStatus === "Normal"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {selectedOrderInfo.PartnerStatusText ||
                      selectedOrderInfo.PartnerStatus}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Tổng tiền</label>
                  <p className="text-sm text-muted-foreground">
                    {(selectedOrderInfo.TotalAmount || 0).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    đ
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số lượng</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.TotalQuantity}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ghi chú</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.Note || "Không có"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ngày tạo</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.DateCreated
                      ? format(
                          new Date(selectedOrderInfo.DateCreated),
                          "dd/MM/yyyy HH:mm:ss",
                        )
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
