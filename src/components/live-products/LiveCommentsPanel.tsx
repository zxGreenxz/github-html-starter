import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Heart, Search, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LiveCommentsPanelProps {
  pageId: string;
  videoId: string;
  comments: FacebookComment[];
  ordersData: TPOSOrder[];
  newCommentIds: Set<string>;
  showOnlyWithOrders: boolean;
  hideNames: string[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onRefresh?: () => void;
}

export function LiveCommentsPanel({
  pageId,
  videoId,
  comments,
  ordersData,
  newCommentIds,
  showOnlyWithOrders,
  hideNames,
  isLoading,
  onLoadMore,
  hasMore,
  onRefresh,
}: LiveCommentsPanelProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Load cache from localStorage on mount
  const loadCacheFromStorage = (): Map<string, any> => {
    const cached = localStorage.getItem('liveComments_customerStatusCache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return new Map(Object.entries(parsed));
      } catch (e) {
        console.error('[LiveCommentsPanel] Error loading cache:', e);
      }
    }
    return new Map();
  };
  
  const [customerStatusMap, setCustomerStatusMap] = useState<Map<string, any>>(loadCacheFromStorage);
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const fetchInProgress = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customerStatusMapRef = useRef<Map<string, any>>(loadCacheFromStorage());
  const [confirmCreateOrderComment, setConfirmCreateOrderComment] = useState<CommentWithStatus | null>(null);
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedCommentIds = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(new Set());

  const mapStatusText = (statusText: string | null | undefined): string => {
    if (!statusText) return 'Bình thường';
    const normalizedStatus = statusText.trim().toLowerCase();
    const statusMap: Record<string, string> = {
      'normal': 'Bình thường',
      'bomb': 'Bom hàng',
      'warning': 'Cảnh báo',
      'wholesale': 'Khách sỉ',
      'danger': 'Nguy hiểm',
      'close': 'Thân thiết',
      'vip': 'VIP',
      'thieu thong tin': 'Thiếu thông tin',
      'incomplete': 'Cần thêm TT',
      'bình thường': 'Bình thường',
      'bom hàng': 'Bom hàng',
      'cảnh báo': 'Cảnh báo',
      'khách sỉ': 'Khách sỉ',
      'nguy hiểm': 'Nguy hiểm',
      'thân thiết': 'Thân thiết',
      'thiếu thông tin': 'Thiếu thông tin',
      'cần thêm tt': 'Cần thêm TT',
    };
    return statusMap[normalizedStatus] || 'Bình thường';
  };

  const fetchPartnerStatusBatch = useCallback(async (
    commentsToProcess: FacebookComment[], 
    orders: TPOSOrder[]
  ) => {
    if (fetchInProgress.current || commentsToProcess.length === 0) return;

    console.log(`[LiveCommentsPanel] Starting fetch for ${commentsToProcess.length} comments`);
    fetchInProgress.current = true;
    setIsLoadingCustomerStatus(true);

    // Set timeout protection (15 seconds)
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      console.warn('[LiveCommentsPanel] Fetch timeout - resetting fetch lock');
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
    }, 15000);

    try {
      const facebookIdsToFetch = [
        ...new Set(
          commentsToProcess
            .map(c => c.from.id)
            .filter(id => id && !customerStatusMapRef.current.has(id))
        )
      ];
      
      if (facebookIdsToFetch.length === 0) {
        console.log('[LiveCommentsPanel] No new IDs to fetch');
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchInProgress.current = false;
        setIsLoadingCustomerStatus(false);
        return;
      }
      
      console.log(`[LiveCommentsPanel] Fetching ${facebookIdsToFetch.length} new Facebook IDs`);
      
      const userOrderMap = new Map<string, TPOSOrder>();
      for (const order of orders) {
        if (order.Facebook_ASUserId && !userOrderMap.has(order.Facebook_ASUserId)) {
          userOrderMap.set(order.Facebook_ASUserId, order);
        }
      }

      // Fetch pending orders with order_count
      const { data: pendingOrders = [] } = await supabase
        .from('facebook_pending_orders')
        .select('facebook_comment_id, code, tpos_order_id, order_count, phone')
        .in('facebook_user_id', facebookIdsToFetch)
        .order('order_count', { ascending: false });

      // Create a map to get the latest order info for each comment
      const commentOrderMap = new Map<string, any>();
      for (const order of pendingOrders) {
        if (!commentOrderMap.has(order.facebook_comment_id)) {
          commentOrderMap.set(order.facebook_comment_id, order);
        }
      }

      const { data: existingCustomers = [], error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIdsToFetch);
      
      if (fetchError) {
        console.error('[LiveCommentsPanel] Error fetching customers:', fetchError);
      }
      
      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));

      const customersToUpsert: any[] = [];
      const newStatusMap = new Map(customerStatusMapRef.current);

      for (const facebookId of facebookIdsToFetch) {
        const order = userOrderMap.get(facebookId);
        const existingCustomer = existingCustomersMap.get(facebookId);
        const commentAuthorName = commentsToProcess.find(c => c.from.id === facebookId)?.from.name || 'Unknown';
        const commentId = commentsToProcess.find(c => c.from.id === facebookId)?.id;
        const pendingOrderInfo = commentId ? commentOrderMap.get(commentId) : null;

        let partnerStatus: string;
        let customerDataForUpsert: any;
        let orderInfoWithCount = order;

        // Add order_count from pending orders if available
        if (order && pendingOrderInfo?.order_count) {
          orderInfoWithCount = { ...order, order_count: pendingOrderInfo.order_count };
        }

        if (order && order.Telephone) {
          partnerStatus = mapStatusText(existingCustomer?.customer_status || order.PartnerStatusText);
          customerDataForUpsert = {
            facebook_id: facebookId,
            customer_name: order.Name || commentAuthorName,
            phone: order.Telephone,
            customer_status: partnerStatus,
            info_status: 'complete',
          };
        } else if (existingCustomer) {
          partnerStatus = mapStatusText(existingCustomer.customer_status);
          if (!existingCustomer.phone || existingCustomer.info_status === 'incomplete') {
            partnerStatus = 'Cần thêm TT';
          }
        } else {
          partnerStatus = 'Khách lạ';
          customerDataForUpsert = {
            facebook_id: facebookId,
            customer_name: commentAuthorName,
            phone: null,
            customer_status: 'Bình thường',
            info_status: 'incomplete',
          };
        }

        if (customerDataForUpsert) {
          customersToUpsert.push(customerDataForUpsert);
        }

        newStatusMap.set(facebookId, {
          partnerStatus,
          orderInfo: orderInfoWithCount,
          isLoadingStatus: false,
        });
      }

      if (customersToUpsert.length > 0) {
        console.log(`[LiveCommentsPanel] Upserting ${customersToUpsert.length} customers`);
        const { error: upsertError } = await supabase
          .from('customers')
          .upsert(customersToUpsert, {
            onConflict: 'facebook_id',
            ignoreDuplicates: false,
          });
        
        if (upsertError) {
          console.error('[LiveCommentsPanel] Error upserting customers:', upsertError);
        }
      }

      customerStatusMapRef.current = newStatusMap;
      setCustomerStatusMap(newStatusMap);
      
      // Save to localStorage
      try {
        const cacheObj = Object.fromEntries(newStatusMap);
        localStorage.setItem('liveComments_customerStatusCache', JSON.stringify(cacheObj));
      } catch (e) {
        console.error('[LiveCommentsPanel] Error saving cache:', e);
      }
      
      console.log(`[LiveCommentsPanel] Successfully updated ${newStatusMap.size} customer statuses`);
    } catch (error) {
      console.error('[LiveCommentsPanel] Error in fetchPartnerStatusBatch:', error);
      // Don't throw - let the component continue working
    } finally {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
      console.log('[LiveCommentsPanel] Fetch completed');
    }
  }, []);

  // Force refresh status for a single user (used after creating order)
  const refreshSingleUserStatus = useCallback(async (facebookId: string, commentId: string) => {
    console.log(`[LiveCommentsPanel] Force refresh status for user: ${facebookId}`);
    
    try {
      // Fetch fresh data from TPOS API for this specific user
      const { data: pendingOrders = [] } = await supabase
        .from('facebook_pending_orders')
        .select('facebook_comment_id, code, tpos_order_id, order_count, phone')
        .eq('facebook_user_id', facebookId)
        .order('order_count', { ascending: false });

      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('facebook_id', facebookId)
        .maybeSingle();

      // Find order from ordersData
      const order = ordersData.find(o => o.Facebook_ASUserId === facebookId);
      const pendingOrderInfo = pendingOrders.find(po => po.facebook_comment_id === commentId);

      let orderInfoWithCount = order;
      if (order && pendingOrderInfo?.order_count) {
        orderInfoWithCount = { ...order, order_count: pendingOrderInfo.order_count };
      }

      // Update cache
      const newStatusMap = new Map(customerStatusMapRef.current);
      const partnerStatus = mapStatusText(customer?.customer_status || order?.PartnerStatusText || 'Bình thường');
      
      newStatusMap.set(facebookId, {
        partnerStatus,
        orderInfo: orderInfoWithCount || pendingOrderInfo,
        isLoadingStatus: false,
      });

      customerStatusMapRef.current = newStatusMap;
      setCustomerStatusMap(newStatusMap);
      
      // Save to localStorage
      try {
        const cacheObj = Object.fromEntries(newStatusMap);
        localStorage.setItem('liveComments_customerStatusCache', JSON.stringify(cacheObj));
      } catch (e) {
        console.error('[LiveCommentsPanel] Error saving cache:', e);
      }
      
      console.log(`[LiveCommentsPanel] Updated cache for user ${facebookId}`);
    } catch (error) {
      console.error('[LiveCommentsPanel] Error refreshing user status:', error);
    }
  }, [ordersData]);

  // Debounced effect to prevent excessive fetching
  useEffect(() => {
    if (comments.length === 0) return;

    // Find truly new comments (not yet processed)
    const newComments = comments.filter(c => !processedCommentIds.current.has(c.id));
    
    // Skip if already did initial fetch and no new comments
    if (initialFetchDone.current && newComments.length === 0) {
      console.log('[LiveCommentsPanel] No new comments, skipping fetch');
      return;
    }

    console.log(`[LiveCommentsPanel] Found ${newComments.length} new comments out of ${comments.length} total`);

    // Clear previous debounce timer
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce for 500ms to prevent rapid fetches
    debounceTimeoutRef.current = setTimeout(() => {
      // Fetch only for new comments if we have some, otherwise fetch all
      fetchPartnerStatusBatch(newComments.length > 0 ? newComments : comments, ordersData);
      
      // Mark as done and track processed IDs
      initialFetchDone.current = true;
      comments.forEach(c => processedCommentIds.current.add(c.id));
    }, 500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [comments, ordersData, fetchPartnerStatusBatch]);

  // Reset tracking when video changes (but keep cache)
  useEffect(() => {
    console.log('[LiveCommentsPanel] Video changed, resetting tracking only');
    initialFetchDone.current = false;
    processedCommentIds.current = new Set();
    // Don't clear cache - it's shared across all videos
  }, [videoId]);

  const createOrderMutation = useMutation({
    mutationFn: async ({ comment }: { comment: FacebookComment }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-tpos-order-from-comment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            comment, 
            video: { objectId: videoId } 
          }),
        }
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(responseData));
      }

      return responseData;
    },
    onMutate: (variables) => {
      setPendingCommentIds(prev => new Set(prev).add(variables.comment.id));
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
      
      // Force refresh status for user who just created order
      const comment = variables.comment;
      if (comment?.from?.id) {
        setTimeout(() => {
          refreshSingleUserStatus(comment.from.id, comment.id);
        }, 1000); // Delay 1s to let TPOS API update
      }
    },
    onError: (error: any) => {
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
      setPendingCommentIds(prev => {
        const next = new Set(prev);
        next.delete(variables.comment.id);
        return next;
      });
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["tpos-orders", videoId] });
      queryClient.invalidateQueries({ queryKey: ["facebook-comments", pageId, videoId] });
    },
  });

  const handleCreateOrderClick = (comment: CommentWithStatus) => {
    if (comment.orderInfo) {
      setConfirmCreateOrderComment(comment);
    } else {
      createOrderMutation.mutate({ comment });
    }
  };

  const confirmCreateOrder = () => {
    if (confirmCreateOrderComment) {
      createOrderMutation.mutate({ comment: confirmCreateOrderComment });
    }
    setConfirmCreateOrderComment(null);
  };

  const commentsWithStatus: CommentWithStatus[] = useMemo(() => {
    return comments.map((comment) => {
      const statusInfo = customerStatusMap.get(comment.from.id);
      // Default to "Khách lạ" instead of "Đang tải..." to prevent stuck loading state
      return {
        ...comment,
        partnerStatus: statusInfo?.partnerStatus || 'Khách lạ',
        orderInfo: statusInfo?.orderInfo,
        isLoadingStatus: statusInfo?.isLoadingStatus ?? false,
      };
    });
  }, [comments, customerStatusMap]);

  const filteredComments = useMemo(() => {
    let filtered = commentsWithStatus;

    if (showOnlyWithOrders) {
      filtered = filtered.filter(comment => comment.orderInfo);
    }

    if (hideNames.length > 0) {
      filtered = filtered.filter(comment => 
        !hideNames.some(name => comment.from.name.toLowerCase().includes(name.toLowerCase()))
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(comment =>
        comment.message?.toLowerCase().includes(query) ||
        comment.from.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [commentsWithStatus, showOnlyWithOrders, hideNames, searchQuery]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'Bom hàng': 'bg-red-500',
      'Cảnh báo': 'bg-orange-500',
      'Nguy hiểm': 'bg-red-700',
      'Khách lạ': 'bg-gray-500',
      'Cần thêm TT': 'bg-yellow-500',
      'Bình thường': 'bg-green-500',
      'Khách sỉ': 'bg-blue-500',
      'Thân thiết': 'bg-purple-500',
      'VIP': 'bg-amber-500',
    };
    return statusColors[status] || 'bg-gray-500';
  };

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Search with Refresh Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={cn(
            "absolute left-2 text-muted-foreground",
            isMobile ? "top-2 h-3.5 w-3.5" : "top-2.5 h-4 w-4"
          )} />
          <Input
            placeholder="Tìm comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-8",
              isMobile ? "h-8 text-xs" : "h-9 text-sm"
            )}
          />
        </div>
        <Button
          variant="outline"
          size={isMobile ? "sm" : "default"}
          className={isMobile ? "h-8 px-2" : "h-9 px-3"}
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn(
            isMobile ? "h-3.5 w-3.5" : "h-4 w-4",
            isLoading && "animate-spin"
          )} />
        </Button>
      </div>

      {/* Comments List */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className={cn("space-y-2", isMobile ? "pr-2" : "pr-4")}>
          {isLoading && filteredComments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredComments.length === 0 ? (
            <div className={cn(
              "text-center py-8 text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Không có comment nào
            </div>
          ) : (
            <>
              {filteredComments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    isMobile ? "p-2" : "p-3",
                    newCommentIds.has(comment.id) ? 'bg-accent' : 'bg-card'
                  )}
                >
                  {/* Header: Avatar, Name, Order Code, Status, Phone */}
                  <div className={cn(
                    "flex items-start gap-2",
                    isMobile ? "mb-1.5" : "mb-2"
                  )}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "rounded-full flex items-center justify-center bg-red-500 text-white font-semibold",
                        isMobile ? "w-8 h-8 text-[9px]" : "w-10 h-10 text-[10px]"
                      )}>
                        {comment.orderInfo?.SessionIndex || ''}
                      </div>
                    </div>

                    {/* Name, Order Code, Status */}
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "flex items-center justify-between gap-1.5",
                        isMobile ? "mb-0.5" : "mb-1"
                      )}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "font-semibold",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {comment.from.name}
                          </span>

                          {/* Deleted Badge */}
                          {comment.is_deleted_by_tpos && (
                            <Badge 
                              variant="destructive" 
                              className={cn(
                                "font-semibold",
                                isMobile ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0"
                              )}
                            >
                              Đã xóa
                            </Badge>
                          )}

                          {/* Order Count Badge */}
                          {comment.orderInfo?.order_count && comment.orderInfo.order_count > 1 && (
                            <Badge className={cn(
                              "bg-orange-500 text-white font-semibold",
                              isMobile ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0"
                            )}>
                              Lần {comment.orderInfo.order_count}
                            </Badge>
                          )}
                          
                          {/* Phone Number Badge - Hidden on mobile */}
                          {!isMobile && comment.orderInfo?.Telephone && (
                            <Badge className="bg-slate-700 text-white font-semibold text-[10px] px-1.5 py-0">
                              {comment.orderInfo.Telephone}
                            </Badge>
                          )}
                        </div>

                        {/* Comment Time */}
                        {comment.created_time && (
                          <span className={cn(
                            "text-muted-foreground flex-shrink-0",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {format(new Date(comment.created_time), 'HH:mm')}
                          </span>
                        )}
                      </div>

                      {/* Comment Message */}
                      <p className={cn(
                        "text-foreground break-words font-semibold",
                        isMobile ? "text-xs" : "text-sm",
                        comment.is_deleted_by_tpos && "line-through opacity-60"
                      )}>
                        {comment.message || "(Không có nội dung)"}
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className={cn(
                    "flex gap-1.5",
                    isMobile && "flex-wrap"
                  )}>
                    <Button
                      size={isMobile ? "sm" : "default"}
                      className={cn(
                        "flex-1 bg-blue-500 hover:bg-blue-600 text-white",
                        isMobile ? "h-7 text-xs min-w-[80px]" : "h-8 text-xs"
                      )}
                      onClick={() => handleCreateOrderClick(comment)}
                      disabled={pendingCommentIds.has(comment.id)}
                    >
                      {pendingCommentIds.has(comment.id) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Tạo đơn
                    </Button>
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      className={cn(
                        "bg-green-500 hover:bg-green-600 text-white border-green-500",
                        isMobile ? "h-7 text-xs px-2 min-w-[60px]" : "h-8 text-xs"
                      )}
                      onClick={() => {
                        if (comment.orderInfo) {
                          setSelectedOrderInfo(comment.orderInfo);
                          setIsInfoDialogOpen(true);
                        }
                      }}
                    >
                      Info
                    </Button>
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      className={cn(
                        "text-white border-0",
                        isMobile ? "h-7 text-xs px-2 min-w-[70px]" : "h-8 text-xs",
                        getStatusColor(comment.partnerStatus)
                      )}
                    >
                      {comment.partnerStatus}
                    </Button>
                  </div>
                </div>
              ))}

              {hasMore && (
                <Button
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải thêm"}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmCreateOrderComment} onOpenChange={(open) => !open && setConfirmCreateOrderComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tạo đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCreateOrderComment?.orderInfo && (
                <div className="space-y-2">
                  <p>Comment này đã có đơn hàng. Bạn có muốn tạo thêm đơn mới không?</p>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <div><strong>Đơn hiện tại:</strong> {confirmCreateOrderComment.orderInfo.Code}</div>
                    {confirmCreateOrderComment.orderInfo.order_count && (
                      <div><strong>Số lần tạo:</strong> {confirmCreateOrderComment.orderInfo.order_count}</div>
                    )}
                    <div><strong>Tổng tiền:</strong> {confirmCreateOrderComment.orderInfo.TotalAmount?.toLocaleString()} đ</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Đơn mới sẽ là lần thứ {(confirmCreateOrderComment.orderInfo.order_count || 0) + 1}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateOrder}>Tạo đơn mới</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thông tin đơn hàng TPOS</DialogTitle>
            <DialogDescription>Chi tiết đơn hàng từ hệ thống TPOS</DialogDescription>
          </DialogHeader>
          {selectedOrderInfo && (
            <div className="space-y-2 text-sm">
              <div><strong>Mã đơn:</strong> {selectedOrderInfo.Code}</div>
              {selectedOrderInfo.order_count && (
                <div><strong>Đơn hàng lần thứ:</strong> {selectedOrderInfo.order_count}</div>
              )}
              <div><strong>Tên KH:</strong> {selectedOrderInfo.Name}</div>
              <div><strong>SĐT:</strong> {selectedOrderInfo.Telephone}</div>
              <div><strong>Ghi chú:</strong> {selectedOrderInfo.Note}</div>
              <div><strong>Tổng tiền:</strong> {selectedOrderInfo.TotalAmount?.toLocaleString()} đ</div>
              <div><strong>Số lượng:</strong> {selectedOrderInfo.TotalQuantity}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}