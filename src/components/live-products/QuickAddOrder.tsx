import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toZonedTime } from 'date-fns-tz';
import { getHours, getMinutes } from 'date-fns';
import { getActivePrinter } from '@/lib/printer-utils';
interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
  onOrderAdded?: (quantity: number) => void;
}
type PendingOrder = {
  id: string;
  name: string | null;
  session_index: string | null;
  code: string | null;
  tpos_order_id: string | null;
  phone: string | null;
  comment: string | null;
  created_time: string;
  facebook_comment_id: string | null;
  facebook_user_id: string | null;
  facebook_post_id: string | null;
  order_count: number;
};
export function QuickAddOrder({
  productId,
  phaseId,
  sessionId,
  availableQuantity,
  onOrderAdded
}: QuickAddOrderProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // State for hiding comments (client-side only, persisted in localStorage)
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('quickAddOrder_hiddenComments');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist hidden comments to localStorage
  useEffect(() => {
    localStorage.setItem('quickAddOrder_hiddenComments', JSON.stringify([...hiddenCommentIds]));
  }, [hiddenCommentIds]);

  // Fetch phase data to get the date and phase_type
  const {
    data: phaseData
  } = useQuery({
    queryKey: ['live-phase', phaseId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('live_phases').select('phase_date, phase_type').eq('id', phaseId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId
  });

  // Fetch existing orders and count usage per comment
  const {
    data: existingOrders = []
  } = useQuery({
    queryKey: ['live-orders', phaseId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('live_orders').select('order_code, facebook_comment_id').eq('live_phase_id', phaseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId
  });

  // Fetch facebook_pending_orders for the phase date (include order_count)
  const {
    data: pendingOrders = []
  } = useQuery({
    queryKey: ['facebook-pending-orders', phaseData?.phase_date],
    queryFn: async () => {
      if (!phaseData?.phase_date) return [];
      let query: any = supabase
        .from('facebook_pending_orders')
        .select('*, order_count');
      
      query = query.eq('comment_type', 'hang_dat');
      query = query.gte('created_time', `${phaseData.phase_date}T00:00:00`);
      query = query.lt('created_time', `${phaseData.phase_date}T23:59:59`);
      query = query.order('created_time', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PendingOrder[];
    },
    enabled: !!phaseData?.phase_date,
    refetchInterval: 5000
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!phaseData?.phase_date) return;
    const channel = supabase.channel('facebook-pending-orders-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'facebook_pending_orders'
    }, payload => {
      // Only refetch if the new order is for today's phase
      if (!payload.new || typeof payload.new !== 'object') return;
      const createdTime = new Date((payload.new as any).created_time);
      const phaseDate = new Date(phaseData.phase_date);
      if (createdTime.getDate() === phaseDate.getDate() && createdTime.getMonth() === phaseDate.getMonth() && createdTime.getFullYear() === phaseDate.getFullYear()) {
        queryClient.invalidateQueries({
          queryKey: ['facebook-pending-orders', phaseData.phase_date]
        });
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [phaseData?.phase_date, queryClient]);

  // Count how many times each comment has been used
  const commentUsageCount = React.useMemo(() => {
    const countMap = new Map<string, number>();
    existingOrders.forEach(order => {
      if (order.facebook_comment_id) {
        const current = countMap.get(order.facebook_comment_id) || 0;
        countMap.set(order.facebook_comment_id, current + 1);
      }
    });
    return countMap;
  }, [existingOrders]);

  // Flatten all comments with remaining > 0, sorted by created_time (newest first)
  const flatComments = React.useMemo(() => {
    const comments: {
      id: string;
      sessionIndex: string;
      name: string | null;
      comment: string | null;
      facebook_comment_id: string;
      created_time: string;
      remaining: number;
      total: number;
    }[] = [];
    pendingOrders.forEach(order => {
      if (!order.session_index || !order.facebook_comment_id) return;
      const used = commentUsageCount.get(order.facebook_comment_id) || 0;
      const total = order.order_count || 1;
      const remaining = total - used;
      if (remaining <= 0) return; // skip consumed comments

      // Filter by phase_type time range (UTC+7)
      if (phaseData?.phase_type) {
        const commentTime = toZonedTime(new Date(order.created_time), 'Asia/Bangkok');
        const hours = getHours(commentTime);
        const minutes = getMinutes(commentTime);
        const totalMinutes = hours * 60 + minutes;

        if (phaseData.phase_type === 'morning') {
          // Morning: 0h01 - 12h30 (1 phút - 750 phút)
          if (totalMinutes < 1 || totalMinutes > 750) return;
        } else if (phaseData.phase_type === 'evening') {
          // Evening: 12h31 - 23h59 (751 phút - 1439 phút)
          if (totalMinutes < 751 || totalMinutes > 1439) return;
        }
      }

      comments.push({
        id: order.id,
        sessionIndex: order.session_index,
        name: order.name,
        comment: order.comment,
        facebook_comment_id: order.facebook_comment_id,
        created_time: order.created_time,
        remaining,
        total
      });
    });

    // Sort by created_time descending (newest first)
    comments.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());

    // Filter out hidden comments (client-side only)
    return comments.filter(c => !hiddenCommentIds.has(c.facebook_comment_id));
  }, [pendingOrders, commentUsageCount, hiddenCommentIds, phaseData?.phase_type]);
  const addOrderMutation = useMutation({
    mutationFn: async ({
      sessionIndex,
      commentId
    }: {
      sessionIndex: string;
      commentId: string;
    }) => {
      // Get current product data to check if overselling
      const {
        data: product,
        error: fetchError
      } = await supabase.from('live_products').select('sold_quantity, prepared_quantity, product_code, product_name').eq('id', productId).single();
      if (fetchError) throw fetchError;

      // Get pending order details for bill (null if manual entry)
      const pendingOrder = commentId !== 'MANUAL_ENTRY' 
        ? pendingOrders.find(order => order.facebook_comment_id === commentId)
        : null;

      // Check if this order will be an oversell
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order with oversell flag and comment ID (null if manual entry)
      const {
        error: orderError
      } = await supabase.from('live_orders').insert({
        order_code: sessionIndex,
        facebook_comment_id: commentId === 'MANUAL_ENTRY' ? null : commentId,
        tpos_order_id: pendingOrder?.code || null,
        code_tpos_order_id: pendingOrder?.tpos_order_id || null,
        live_session_id: sessionId,
        live_phase_id: phaseId,
        live_product_id: productId,
        quantity: 1,
        is_oversell: isOversell
      });
      if (orderError) throw orderError;

      // Update sold quantity
      const {
        error: updateError
      } = await supabase.from('live_products').update({
        sold_quantity: newSoldQuantity
      }).eq('id', productId);
      if (updateError) throw updateError;
      return {
        sessionIndex,
        isOversell,
        billData: pendingOrder ? {
          sessionIndex,
          phone: pendingOrder.phone,
          customerName: pendingOrder.name,
          productCode: product.product_code,
          productName: product.product_name,
          comment: pendingOrder.comment,
          createdTime: pendingOrder.created_time
        } : null
      };
    },
    onSuccess: async ({
      sessionIndex,
      isOversell,
      billData
    }) => {
      setInputValue('');
      
      // Notify parent component to increment order quantity
      onOrderAdded?.(1);
      
      // Force refetch all related queries immediately
      queryClient.invalidateQueries({
        queryKey: ['live-orders', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['live-products', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['orders-with-products', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['facebook-pending-orders', phaseData?.phase_date]
      });

      // Also refetch queries to ensure UI updates immediately
      queryClient.refetchQueries({
        queryKey: ['live-orders', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['live-products', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['orders-with-products', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['facebook-pending-orders', phaseData?.phase_date]
      });

      // Auto-print bill using HTML → Canvas → Bitmap (silent print)
      if (billData) {
        const activePrinter = getActivePrinter();
        if (activePrinter) {
          try {
            console.log('🖨️ [Silent Print] Starting HTML to bitmap conversion...');
            
            // Dynamic import html2canvas
            const html2canvas = (await import('html2canvas')).default;
            
            // Create bill HTML element
            const billElement = document.createElement('div');
            billElement.style.cssText = `
              position: absolute;
              left: -9999px;
              width: 384px;
              padding: 10px;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
            `;
            
            billElement.innerHTML = `
              <div style="display: flex; flex-direction: column; gap: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold;">#${billData.sessionIndex}</div>
                <div style="font-size: 24px; font-weight: bold;">${billData.phone || 'Chưa có SĐT'}</div>
                <div style="font-size: 28px; font-weight: bold;">${billData.customerName}</div>
                <div style="font-size: 16px; font-weight: bold;">${billData.productCode}</div>
                <div style="font-size: 16px;">${billData.productName.replace(/^\d+\s+/, '')}</div>
                ${billData.comment ? `<div style="font-size: 28px; font-weight: bold; font-style: italic;">${billData.comment}</div>` : ''}
                <div style="font-size: 10px; font-weight: bold; margin-top: 8px;">
                  ${new Date(billData.createdTime).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Bangkok',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            `;
            
            document.body.appendChild(billElement);
            
            // Convert HTML to Canvas
            const canvas = await html2canvas(billElement, {
              backgroundColor: '#ffffff',
              scale: 1,
              logging: false,
              width: 384,
            });
            
            document.body.removeChild(billElement);
            
            console.log(`✅ [Silent Print] Canvas created: ${canvas.width}x${canvas.height}`);
            
            // Convert canvas to monochrome bitmap
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const bytesPerLine = Math.ceil(canvas.width / 8);
            const totalBytes = bytesPerLine * canvas.height;
            const monoData = new Uint8Array(totalBytes);
            
            // Convert to 1-bit monochrome
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = imageData.data[pixelIndex];
                const g = imageData.data[pixelIndex + 1];
                const b = imageData.data[pixelIndex + 2];
                const gray = (r + g + b) / 3;
                const isBlack = gray < 128 ? 1 : 0;
                
                const byteIndex = y * bytesPerLine + Math.floor(x / 8);
                const bitIndex = 7 - (x % 8);
                
                if (isBlack) {
                  monoData[byteIndex] |= (1 << bitIndex);
                }
              }
            }
            
            // Encode to ESC/POS format
            const header = new Uint8Array([
              0x1D, 0x76, 0x30,
              0x00,
              bytesPerLine & 0xFF,
              (bytesPerLine >> 8) & 0xFF,
              canvas.height & 0xFF,
              (canvas.height >> 8) & 0xFF
            ]);
            
            const cutCommands = new Uint8Array([
              0x1B, 0x64, 0x03,
              0x1D, 0x56, 0x42
            ]);
            
            const bitmapData = new Uint8Array(header.length + monoData.length + cutCommands.length);
            bitmapData.set(header, 0);
            bitmapData.set(monoData, header.length);
            bitmapData.set(cutCommands, header.length + monoData.length);
            
            // Send to printer
            const base64Data = btoa(String.fromCharCode(...bitmapData));
            const bridgeUrl = activePrinter.bridge_url.replace(/\/$/, '');
            const response = await fetch(`${bridgeUrl}/print/bitmap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ip: activePrinter.ip,
                port: activePrinter.port,
                data: base64Data
              })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              console.log('✅ [Silent Print] Bill printed successfully');
            } else {
              throw new Error(result.error || 'Print failed');
            }
            
          } catch (error) {
            console.error('❌ [Silent Print] Error:', error);
            toast({
              title: "⚠️ Lỗi in bill",
              description: error instanceof Error ? error.message : "Unknown error",
              variant: "destructive"
            });
          }
        } else {
          console.log('⚠️ [Silent Print] No active printer found');
        }
      }
      const isManualEntry = !billData;
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell 
          ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)${isManualEntry ? ' (nhập tay)' : ''}`
          : `Đã thêm đơn hàng ${sessionIndex}${isManualEntry ? ' (nhập tay)' : ''}`,
        variant: isOversell ? "destructive" : "default"
      });
    },
    onError: error => {
      console.error('Error adding order:', error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm đơn hàng. Vui lòng thử lại.",
        variant: "destructive"
      });
    }
  });
  const handleHideComment = (e: React.MouseEvent, commentId: string) => {
    e.stopPropagation();
    setHiddenCommentIds(prev => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });
    toast({
      title: "Đã ẩn comment",
      description: "Comment đã được ẩn khỏi danh sách (dữ liệu vẫn còn nguyên)"
    });
  };
  const handleSelectComment = (sessionIndex: string, commentId: string) => {
    addOrderMutation.mutate({
      sessionIndex,
      commentId
    });
    setIsOpen(false);
  };
  const handleAddOrder = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã đơn hàng",
        variant: "destructive"
      });
      return;
    }

    // Find first comment matching sessionIndex
    const matchedComment = flatComments.find(c => c.sessionIndex === trimmedValue);
    
    // Allow manual entry even if no comment found
    const commentIdToUse = matchedComment?.facebook_comment_id || 'MANUAL_ENTRY';
    handleSelectComment(trimmedValue, commentIdToUse);
  };
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddOrder();
    }
  };
  const isOutOfStock = availableQuantity <= 0;
  return <div className="w-full flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={handleKeyPress} onClick={() => setIsOpen(true)} placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."} className={cn("text-sm h-9", isOutOfStock && "border-red-500")} disabled={addOrderMutation.isPending} />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[520px] p-0 z-[100] bg-popover" align="start" side="bottom" sideOffset={4} onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onMouseLeave={() => setIsOpen(false)} onPointerDownOutside={e => {
        const target = e.target as HTMLElement;
        if (target.closest('[role="combobox"]') || target.closest('input[type="text"]')) {
          e.preventDefault();
        }
      }}>
          <Command shouldFilter={false} className="bg-popover">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <CommandInput placeholder="Tìm mã đơn hoặc tên..." value={inputValue} onValueChange={setInputValue} className="bg-background border-0 flex-1" />
              {hiddenCommentIds.size > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs ml-2" onClick={() => {
              setHiddenCommentIds(new Set());
              toast({
                title: "Đã hiện lại tất cả",
                description: `${hiddenCommentIds.size} comment đã được hiện lại`
              });
            }}>
                  <EyeOff className="mr-1 h-3 w-3" />
                  Hiện {hiddenCommentIds.size}
                </Button>}
            </div>
            <CommandList className="bg-popover">
              <CommandEmpty>Không thấy mã phù hợp.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[280px]">
                  {flatComments.filter(comment => !inputValue || comment.sessionIndex?.includes(inputValue) || (comment.name || '').toLowerCase().includes(inputValue.toLowerCase()) || (comment.comment || '').toLowerCase().includes(inputValue.toLowerCase())).map(comment => <CommandItem key={comment.id} className="cursor-pointer flex flex-col items-start gap-1 py-3" onSelect={() => handleSelectComment(comment.sessionIndex, comment.facebook_comment_id)}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-medium shrink-0">#{comment.sessionIndex}</span>
                            <span className="shrink-0">-</span>
                            <span className="font-bold truncate">{comment.name || '(không tên)'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            <span>{new Date(comment.created_time).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                            <span className="rounded bg-muted px-2 py-0.5">
                              {comment.remaining}
                            </span>
                            <Button variant="ghost" size="icon" onClick={e => handleHideComment(e, comment.facebook_comment_id)} title="Ẩn comment" className="h-10 w-20 text-muted-foreground hover:text-white hover:bg-destructive transition-colors">
                              <EyeOff className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        {comment.comment && <div className="font-bold text-sm pl-0 w-full">
                            {comment.comment}
                          </div>}
                      </CommandItem>)}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Button onClick={handleAddOrder} disabled={addOrderMutation.isPending || !inputValue.trim()} size="sm" className="h-9">
        <Plus className="h-4 w-4" />
      </Button>
    </div>;
}