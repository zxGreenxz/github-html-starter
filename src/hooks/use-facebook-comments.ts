import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FacebookVideo, FacebookComment, TPOSOrder } from "@/types/facebook";

interface UseFacebookCommentsProps {
  pageId: string;
  videoId?: string;
  isAutoRefresh?: boolean;
}

export function useFacebookComments({ pageId, videoId, isAutoRefresh = true }: UseFacebookCommentsProps) {
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const allCommentIdsRef = useRef<Set<string>>(new Set());
  const [errorCount, setErrorCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const isCheckingNewCommentsRef = useRef(false);

  // Realtime check for new comments (only when live)
  useEffect(() => {
    if (!videoId || !selectedVideo || !isAutoRefresh || selectedVideo.statusLive !== 1) {
      return;
    }

    const checkForNewComments = async () => {
      if (isCheckingNewCommentsRef.current) return;
      
      isCheckingNewCommentsRef.current = true;
      
      try {
        console.log('[Realtime Check] Fetching from TPOS API...');
        
        const { data: { session } } = await supabase.auth.getSession();
        
        // Fetch trực tiếp - Edge function sẽ xử lý merge, debounce và push vào archive
        await fetch(
          `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${videoId}&sessionIndex=${videoId}&limit=500`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }
        );
        
        console.log('[Realtime Check] ✅ Fetch completed');
      } catch (error) {
        console.error('[Realtime Check] Error:', error);
      } finally {
        isCheckingNewCommentsRef.current = false;
      }
    };
    
    checkForNewComments();
    
    // Check every 5 seconds when live
    const interval = setInterval(checkForNewComments, 5000);
    
    return () => clearInterval(interval);
  }, [videoId, selectedVideo, isAutoRefresh, pageId, queryClient]);

  // Fetch comments with infinite scroll
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchComments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useInfiniteQuery({
    queryKey: ['facebook-comments', pageId, videoId],
    queryFn: async ({ pageParam }) => {
      if (!pageId || !videoId) return { data: [], paging: {} };
      
      console.log(`[useFacebookComments] Fetching comments from archive for video ${videoId}`);
      const startTime = Date.now();
      
      // ========== ALWAYS READ FROM ARCHIVE TABLE ==========
      const { data: archivedComments, error: dbError } = await supabase
        .from('facebook_comments_archive' as any)
        .select('*')
        .eq('facebook_post_id', videoId)
        .order('comment_created_time', { ascending: false })
        .limit(1000);
      
      if (dbError) {
        console.error('[useFacebookComments] Archive DB error:', dbError);
        return { data: [], paging: {} };
      }
      
      const formattedComments = archivedComments?.map((c: any) => ({
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
      })) || [];
      
      const elapsed = Date.now() - startTime;
      console.log(`[useFacebookComments] Loaded ${formattedComments.length} comments from archive in ${elapsed}ms`);
      
      setErrorCount(0);
      setHasError(false);
      
      return { 
        data: formattedComments, 
        paging: {},
        fromArchive: true 
      };
    },
    getNextPageParam: (lastPage) => {
      // No pagination for archive data
      return undefined;
    },
    initialPageParam: undefined,
    enabled: !!videoId && !!pageId,
    refetchInterval: false, // Disabled - using realtime check instead
    retry: (failureCount, error) => {
      console.log(`[useFacebookComments] Retry attempt ${failureCount} for error:`, error);
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap(page => page.data) || [];
    const uniqueComments = new Map<string, FacebookComment>();
    allComments.forEach(comment => {
      uniqueComments.set(comment.id, comment);
    });
    return Array.from(uniqueComments.values());
  }, [commentsData]);

  // Track new comments
  useEffect(() => {
    if (comments.length === 0) return;

    const currentIds = new Set(comments.map((c) => c.id));
    const newIds = new Set<string>();

    currentIds.forEach((id) => {
      if (!allCommentIdsRef.current.has(id)) {
        newIds.add(id);
        allCommentIdsRef.current.add(id);
      }
    });

    if (newIds.size > 0) {
      setNewCommentIds(newIds);
      setTimeout(() => setNewCommentIds(new Set()), 3000);
    }
  }, [comments]);

  return {
    comments,
    selectedVideo,
    setSelectedVideo,
    newCommentIds,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetchComments,
    commentsLoading,
    hasError,
    errorCount,
  };
}
