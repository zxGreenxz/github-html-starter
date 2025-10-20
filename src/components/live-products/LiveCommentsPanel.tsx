import { useState, useRef, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Heart, Search, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { FacebookComment } from "@/types/facebook";
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

interface LiveCommentsPanelProps {
  pageId: string;
  videoId: string;
  comments: (FacebookComment & { session_index?: number | null })[];
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
  const [confirmCreateOrderComment, setConfirmCreateOrderComment] = useState<FacebookComment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(new Set());

  // Create order mutation
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
    onSuccess: (data) => {
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
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
      queryClient.invalidateQueries({ queryKey: ["facebook-comments-archive", pageId, videoId] });
    },
  });

  const handleCreateOrderClick = (comment: FacebookComment & { session_index?: number | null }) => {
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
    let filtered = comments;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.from.name.toLowerCase().includes(query) ||
          c.message.toLowerCase().includes(query)
      );
    }

    // Filter by hideNames
    if (hideNames.length > 0) {
      filtered = filtered.filter((c) => !hideNames.includes(c.from.name));
    }

    // Filter by showOnlyWithOrders
    if (showOnlyWithOrders) {
      filtered = filtered.filter((c) => c.session_index);
    }

    return filtered;
  }, [comments, searchQuery, hideNames, showOnlyWithOrders]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
        )}
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {filteredComments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "Không tìm thấy comment phù hợp" : "Chưa có comment nào"}
            </div>
          ) : (
            filteredComments.map((comment) => {
              const isNew = newCommentIds.has(comment.id);
              const isPending = pendingCommentIds.has(comment.id);

              return (
                <div
                  key={comment.id}
                  className={cn(
                    "border rounded-lg p-3 space-y-2 transition-colors",
                    isNew && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                    isPending && "opacity-50"
                  )}
                >
                  {/* Header: Avatar, Name */}
                  <div className="flex items-start gap-2">
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
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={cn(
                          "font-semibold",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {comment.from.name}
                        </span>
                      </div>

                      {/* Message */}
                      <p className={cn(
                        "text-muted-foreground break-words whitespace-pre-wrap",
                        isMobile ? "text-xs mt-1" : "text-sm mt-1.5"
                      )}>
                        {comment.message}
                      </p>

                      {/* Footer: Like count, Time, Actions */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {comment.like_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {comment.like_count}
                            </span>
                          )}
                          <span>
                            {format(new Date(comment.created_time), "HH:mm")}
                          </span>
                        </div>

                        {/* Action button */}
                        <Button
                          size="sm"
                          onClick={() => handleCreateOrderClick(comment)}
                          disabled={isPending || createOrderMutation.isPending}
                          className={cn(
                            isMobile && "text-[10px] px-2 h-6"
                          )}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Đang tạo...
                            </>
                          ) : (
                            "Tạo đơn"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Load more button */}
          {hasMore && onLoadMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  "Tải thêm"
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Confirm dialog for creating order when session_index already exists */}
      <AlertDialog
        open={!!confirmCreateOrderComment}
        onOpenChange={(open) => !open && setConfirmCreateOrderComment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tạo đơn</AlertDialogTitle>
            <AlertDialogDescription>
              Comment này đã có đơn hàng (số {(confirmCreateOrderComment as any)?.session_index}). Bạn có chắc muốn tạo đơn mới?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateOrder}>
              Tạo đơn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
