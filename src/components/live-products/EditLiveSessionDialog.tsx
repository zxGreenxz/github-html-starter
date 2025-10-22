import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Loader2, Video } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FacebookVideo {
  objectId: string;
  title: string;
  statusLive: number;
  countComment: number;
  countReaction: number;
  thumbnail: { url: string };
}

interface LiveSession {
  id: string;
  session_date: string;
  supplier_name: string;
  status: string;
  notes?: string;
  created_at: string;
  facebook_post_id?: string;
}

interface EditLiveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LiveSession | null;
}

interface FormData {
  session_date: Date;
  supplier_name: string;
  notes?: string;
  facebook_post_id?: string;
}

export function EditLiveSessionDialog({ open, onOpenChange, session }: EditLiveSessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      session_date: new Date(),
      supplier_name: "",
      notes: "",
      facebook_post_id: "",
    },
  });

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
    enabled: open,
  });

  // Fetch Facebook Videos when page is selected
  const { data: facebookVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['facebook-videos-for-edit', selectedPageId],
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
    enabled: !!selectedPageId && open,
  });

  // Update form when session changes
  useEffect(() => {
    if (session) {
      form.reset({
        session_date: new Date(session.session_date),
        supplier_name: session.supplier_name,
        notes: session.notes || "",
        facebook_post_id: session.facebook_post_id || "",
      });
    }
  }, [session, form]);

  const updateSessionMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!session) throw new Error("No session to update");
      
      const { error } = await supabase
        .from("live_sessions")
        .update({
          session_date: format(data.session_date, "yyyy-MM-dd"),
          supplier_name: data.supplier_name.trim(),
          notes: data.notes?.trim() || null,
          facebook_post_id: data.facebook_post_id || null,
        })
        .eq("id", session.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      toast.success("Đã cập nhật đợt live thành công");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating live session:", error);
      toast.error("Có lỗi xảy ra khi cập nhật đợt live");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!data.supplier_name.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSessionMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh Sửa Đợt Live</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="session_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Ngày live</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: vi })
                          ) : (
                            <span>Chọn ngày</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên nhà cung cấp *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập tên nhà cung cấp"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Facebook Page (Tùy chọn)</FormLabel>
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
              <FormField
                control={form.control}
                name="facebook_post_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Facebook Video
                      {facebookVideos.find(v => v.statusLive === 1) && (
                        <Badge variant="destructive" className="text-xs">🔴 LIVE</Badge>
                      )}
                    </FormLabel>
                    
                    {videosLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang tải videos...
                      </div>
                    ) : (
                      <>
                        <Select 
                          value={field.value || ''} 
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn video (hoặc nhập ID thủ công)" />
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
                        
                        <FormControl>
                          <Input
                            placeholder="Hoặc nhập Video ID thủ công (objectId)"
                            {...field}
                            className="mt-2"
                          />
                        </FormControl>
                        
                        {field.value && (
                          <div className="p-3 bg-muted rounded-md text-sm mt-2">
                            <div className="font-medium">Video ID:</div>
                            <code className="text-xs break-all">{field.value}</code>
                            
                            {facebookVideos.find(v => v.objectId === field.value) && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {facebookVideos.find(v => v.objectId === field.value)!.title}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ghi chú về đợt live này..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}