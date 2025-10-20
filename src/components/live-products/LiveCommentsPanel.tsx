import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { FacebookComment, CommentWithStatus } from "@/types/facebook";
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
import { Badge } from "@/components/ui/badge";

interface LiveCommentsPanelProps {
  pageId: string;
  videoId: string;
  comments: FacebookComment[];
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
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(new Set());
  const [confirmCreateOrderComment, setConfirmCreateOrderComment] = useState<FacebookComment | null>(null);

  // Realtime subscription to facebook_comments_archive for session_index updates
  useEffect(() => {
    if (!videoId) return;

    const channel = supabase
      .channel('facebook-comments-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'facebook_comments_archive',
          filter: `facebook_post_id=eq.${videoId}`,
        },
        (payload) => {
          console.log('🔄 [Realtime] Comment updated:', payload.new);
          
          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ 
            queryKey: ["facebook-comments-archive", pageId, videoId] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["facebook-comments", pageId, videoId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, pageId, queryClient]);

  // Fetch session_index for comments from archive
  const commentsWithStatus: CommentWithStatus[] = useMemo(() => {
    return comments.map((comment) => ({
      ...comment,
      session_index: (comment as any).session_index || null,
    }));
  }, [comments]);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async ({ comment }: { comment: FacebookComment }) => {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        'https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-tpos-order-from-comment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            comment,
            video: { objectId: videoId },
            commentType: 'hang_dat',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      return response.json();
    },
    onMutate: ({ comment }) => {
      setPendingCommentIds(prev => new Set(prev).add(comment.id));
    },
    onSuccess: (data, variables) => {
      toast({
        title: "✅ Tạo đơn thành công",
        description: `Đã tạo đơn TPOS cho ${variables.comment.from.name}`,
      });
      
      // Delay refresh to allow backend to update
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["facebook-comments-archive", pageId, videoId] });
        queryClient.invalidateQueries({ queryKey: ["facebook-comments", pageId, videoId] });
      }, 500);
    },
    onError: (error: any, variables) => {
      console.error('Error creating order:', error);
      const errorData = error.message;
      toast({
        title: "❌ Lỗi tạo đơn hàng",
        description: errorData || "Có lỗi không xác định",
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      setPendingCommentIds(prev => {
        const next = new Set(prev);
        next.delete(variables.comment.id);
        return next;
      });
    },
  });

  const handleCreateOrderClick = (comment: CommentWithStatus) => {
    if (comment.session_index) {
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

  const filteredComments = useMemo(() => {
    let filtered = commentsWithStatus;

    if (showOnlyWithOrders) {
      filtered = filtered.filter(comment => comment.session_index);
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
          onClick={onRefresh}
          disabled={isLoading}
          className={cn(
            isMobile ? "h-8 px-2" : "h-9 px-3"
          )}
        >
          <RefreshCw className={cn(
            isMobile ? "h-3.5 w-3.5" : "h-4 w-4",
            isLoading && "animate-spin"
          )} />
        </Button>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {filteredComments.length === 0 ? (
            <div className={cn(
              "text-center text-muted-foreground",
              isMobile ? "text-xs py-6" : "text-sm py-8"
            )}>
              {isLoading ? "Đang tải..." : "Không có comment nào"}
            </div>
          ) : (
            <>
              {filteredComments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    newCommentIds.has(comment.id) && "bg-green-50 border-green-200",
                    comment.is_deleted_by_tpos && "opacity-60 bg-red-50",
                    isMobile ? "text-xs" : "text-sm"
                  )}
                >
                  {/* Header: Avatar, Name */}
                  <div className={cn(
                    "flex items-start gap-2",
                    isMobile ? "mb-1.5" : "mb-2"
                  )}>
                    {/* Avatar with session_index */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "rounded-full flex items-center justify-center bg-red-500 text-white font-semibold",
                        isMobile ? "w-8 h-8 text-[9px]" : "w-10 h-10 text-[10px]"
                      )}>
                        {comment.session_index || ''}
                      </div>
                    </div>

                    {/* Name */}
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
                        </div>

                        {/* Timestamp */}
                        <span className={cn(
                          "text-muted-foreground whitespace-nowrap",
                          isMobile ? "text-[10px]" : "text-xs"
                        )}>
                          {format(new Date(comment.created_time), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className={cn(
                    "mb-2 break-words",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {comment.message}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      variant="default"
                      size={isMobile ? "sm" : "default"}
                      className={cn(
                        "bg-blue-500 hover:bg-blue-600",
                        isMobile ? "h-7 text-xs px-2 min-w-[70px]" : "h-8 text-xs"
                      )}
                      onClick={() => handleCreateOrderClick(comment)}
                      disabled={pendingCommentIds.has(comment.id)}
                    >
                      {pendingCommentIds.has(comment.id) && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Tạo đơn
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
              {confirmCreateOrderComment && (
                <div className="space-y-2">
                  <p>Comment này đã có đơn hàng (Session Index: {(confirmCreateOrderComment as any).session_index}). Bạn có muốn tạo thêm đơn mới không?</p>
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
    </div>
  );
}
