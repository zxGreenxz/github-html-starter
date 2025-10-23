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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
}

export function EditLiveSessionDialog({ open, onOpenChange, session }: EditLiveSessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      session_date: new Date(),
      supplier_name: "",
      notes: "",
    },
  });

  // Update form when session changes
  useEffect(() => {
    if (session) {
      form.reset({
        session_date: new Date(session.session_date),
        supplier_name: session.supplier_name,
        notes: session.notes || "",
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