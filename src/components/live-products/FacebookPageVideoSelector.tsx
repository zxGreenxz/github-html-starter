import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Video, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FacebookVideo {
  objectId: string;
  title: string;
  statusLive: number;
  countComment: number;
  countReaction: number;
  thumbnail: { url: string };
}

interface FacebookPageVideoSelectorProps {
  sessionId: string;
  currentFacebookPostId?: string | null;
}

export function FacebookPageVideoSelector({ 
  sessionId, 
  currentFacebookPostId 
}: FacebookPageVideoSelectorProps) {
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>(currentFacebookPostId || '');
  const queryClient = useQueryClient();

  // Sync selectedVideoId with currentFacebookPostId when it changes
  useEffect(() => {
    setSelectedVideoId(currentFacebookPostId || '');
  }, [currentFacebookPostId]);

  // Fetch Facebook Pages
  const { data: facebookPages } = useQuery({
    queryKey: ['facebook-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_pages')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch Facebook Videos when page is selected
  const { data: facebookVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['facebook-videos', selectedPageId],
    queryFn: async () => {
      if (!selectedPageId) return [];
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-livevideo?pageId=${selectedPageId}&limit=10`;
      const { data: { session: authSession } } = await supabase.auth.getSession();

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch videos');
      
      const result = await response.json();
      return (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
    },
    enabled: !!selectedPageId,
  });

  // Mutation to update facebook_post_id
  const updateVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('live_sessions')
        .update({ facebook_post_id: videoId || null })
        .eq('id', sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-session-data', sessionId] });
      toast.success("Đã cập nhật video");
    },
    onError: (error) => {
      console.error("Error updating video:", error);
      toast.error("Có lỗi xảy ra khi cập nhật video");
    },
  });

  const handleVideoChange = (videoId: string) => {
    setSelectedVideoId(videoId);
    updateVideoMutation.mutate(videoId);
  };

  const handleManualVideoInput = (value: string) => {
    setSelectedVideoId(value);
    // Auto-save on blur will be handled by Input onBlur
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Facebook Page</label>
          <Select value={selectedPageId} onValueChange={setSelectedPageId}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn page để load videos" />
            </SelectTrigger>
            <SelectContent>
              {facebookPages?.map(page => (
                <SelectItem key={page.id} value={page.page_id}>
                  {page.page_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPageId && (
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Video className="h-4 w-4" />
              Facebook Video
              {facebookVideos.find(v => v.statusLive === 1) && (
                <Badge variant="destructive" className="text-xs">🔴 LIVE</Badge>
              )}
            </label>
            
            {videosLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải videos...
              </div>
            ) : (
              <Select 
                value={selectedVideoId} 
                onValueChange={handleVideoChange}
              >
              <SelectTrigger>
                <SelectValue placeholder="Chọn video">
                  {selectedVideoId && (() => {
                    const selectedVideo = facebookVideos.find(v => v.objectId === selectedVideoId);
                    if (!selectedVideo) {
                      return <span className="text-muted-foreground">Video ID: {selectedVideoId.slice(0, 20)}...</span>;
                    }
                    return (
                      <div className="flex items-center gap-2">
                        {selectedVideo.statusLive === 1 && (
                          <Badge variant="destructive" className="text-xs shrink-0">🔴 LIVE</Badge>
                        )}
                        <span className="truncate">{selectedVideo.title}</span>
                      </div>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {facebookVideos.map(video => (
                    <SelectItem 
                      key={video.objectId} 
                      value={video.objectId}
                      className="py-2"
                    >
                      <div className="flex items-start gap-2">
                        {video.statusLive === 1 && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            🔴 LIVE
                          </Badge>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm line-clamp-1">
                            {video.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {video.countComment || 0} comments • {video.countReaction || 0} reactions
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Manual video ID input */}
      <div>
        <label className="text-sm font-medium mb-2 block">Hoặc nhập Video ID thủ công</label>
        <Input
          placeholder="Nhập Video ID (objectId)"
          value={selectedVideoId}
          onChange={(e) => handleManualVideoInput(e.target.value)}
          onBlur={() => {
            if (selectedVideoId !== currentFacebookPostId) {
              updateVideoMutation.mutate(selectedVideoId);
            }
          }}
        />
        
        {selectedVideoId && (
          <div className="p-3 bg-muted rounded-md text-sm mt-2">
            <div className="font-medium">Video ID:</div>
            <code className="text-xs break-all">{selectedVideoId}</code>
            
            {facebookVideos.find(v => v.objectId === selectedVideoId) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {facebookVideos.find(v => v.objectId === selectedVideoId)!.title}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
