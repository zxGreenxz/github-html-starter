import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CreateLiveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  session_name: string;
  start_date: Date;
  notes?: string;
}

export function CreateLiveSessionDialog({ open, onOpenChange }: CreateLiveSessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      start_date: new Date(),
      session_name: "",
      notes: "",
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const endDate = new Date(data.start_date);
      endDate.setDate(endDate.getDate() + 2); // 3 days total
      
      const { data: session, error } = await supabase
        .from("live_sessions")
        .insert({
          session_name: data.session_name,
          start_date: data.start_date.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          session_date: data.start_date.toISOString().split('T')[0], // Keep for compatibility
          supplier_name: data.session_name, // Keep for compatibility
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Create the 6 phases for this session
      await supabase.rpc('create_live_phases', {
        session_id: session.id,
        start_date: data.start_date.toISOString().split('T')[0]
      });

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      toast.success("Đã tạo đợt live mới với 6 phiên thành công");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating live session:", error);
      toast.error("Có lỗi xảy ra khi tạo đợt live");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!data.session_name.trim()) {
      toast.error("Vui lòng nhập tên đợt live");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSessionMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating live session:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo đợt Live mới</DialogTitle>
          <DialogDescription>
            Tạo một đợt live 3 ngày với 6 phiên (sáng/chiều mỗi ngày) để quản lý sản phẩm và đơn hàng.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="session_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên đợt live *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập tên đợt live"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Ngày bắt đầu (3 ngày liên tiếp) *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Chọn ngày bắt đầu</span>
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
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
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
                {isSubmitting ? "Đang tạo..." : "Tạo đợt live"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}