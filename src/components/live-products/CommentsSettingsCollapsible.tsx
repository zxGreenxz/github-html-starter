import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronDown, RefreshCw, Pause, Play, MessageSquare } from "lucide-react";
import { FacebookPageManager } from "@/components/facebook/FacebookPageManager";
import type { FacebookVideo } from "@/types/facebook";

interface CommentsSettingsCollapsibleProps {
  pageId: string;
  videoId: string;
  isAutoRefresh: boolean;
  showOnlyWithOrders: boolean;
  hideNhiJudyHouse: boolean;
  hideNames: string[];
  onPageIdChange: (pageId: string) => void;
  onVideoChange: (video: FacebookVideo | null) => void;
  onAutoRefreshToggle: () => void;
  onShowOnlyWithOrdersChange: (checked: boolean) => void;
  onHideNhiJudyHouseChange: (checked: boolean) => void;
  onRefresh: () => void;
}

export function CommentsSettingsCollapsible({
  pageId,
  videoId,
  isAutoRefresh,
  showOnlyWithOrders,
  hideNhiJudyHouse,
  hideNames,
  onPageIdChange,
  onVideoChange,
  onAutoRefreshToggle,
  onShowOnlyWithOrdersChange,
  onHideNhiJudyHouseChange,
  onRefresh,
}: CommentsSettingsCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [limit, setLimit] = useState("1");

  // Auto-collapse when video is selected
  useEffect(() => {
    if (videoId) {
      setIsOpen(false);
    }
  }, [videoId]);

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

  // Fetch videos
  const { data: videos = [], isLoading: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ['facebook-videos', pageId, limit],
    queryFn: async () => {
      if (!pageId) return [];
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-livevideo?pageId=${pageId}&limit=${limit}`;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch videos');
      }

      const result = await response.json();
      return (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
    },
    enabled: !!pageId,
  });

  const selectedPage = facebookPages?.find((p) => p.page_id === pageId);
  const selectedVideo = videos.find((v) => v.objectId === videoId);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Cấu hình theo dõi Comments Facebook</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Facebook Page Manager */}
        <FacebookPageManager />

        {/* Page Selection */}
        <div className="space-y-2">
          <Label>Chọn Facebook Page</Label>
          <Select value={pageId} onValueChange={onPageIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn trang Facebook" />
            </SelectTrigger>
            <SelectContent>
              {facebookPages?.map((page) => (
                <SelectItem key={page.id} value={page.page_id}>
                  {page.page_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Video Selection */}
        {pageId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chọn Video Livestream</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchVideos()}
                disabled={videosLoading}
              >
                <RefreshCw className={`h-4 w-4 ${videosLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Select 
              value={videoId} 
              onValueChange={(value) => {
                const video = videos.find(v => v.objectId === value);
                onVideoChange(video || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn video" />
              </SelectTrigger>
              <SelectContent>
                {videos.map((video) => (
                  <SelectItem key={video.objectId} value={video.objectId}>
                    <div className="flex items-center gap-2">
                      {video.statusLive === 1 && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                      <span className="truncate max-w-[300px]">
                        {video.title || `Video ${video.objectId.substring(0, 8)}...`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Controls */}
        {videoId && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoRefreshToggle}
            >
              {isAutoRefresh ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Tạm dừng
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Tiếp tục
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Làm mới
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showOnlyWithOrders"
              checked={showOnlyWithOrders}
              onCheckedChange={onShowOnlyWithOrdersChange}
            />
            <Label htmlFor="showOnlyWithOrders" className="text-sm cursor-pointer">
              Chỉ hiện comment có đơn hàng
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideNhiJudyHouse"
              checked={hideNhiJudyHouse}
              onCheckedChange={onHideNhiJudyHouseChange}
            />
            <Label htmlFor="hideNhiJudyHouse" className="text-sm cursor-pointer">
              Ẩn "Nhi Judy House"
            </Label>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
