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
import { getActivePrinter } from '@/lib/printer-config-utils';
import { usePrintQueue } from '@/contexts/PrintQueueContext';
import { toZonedTime } from 'date-fns-tz';
import { getHours, getMinutes } from 'date-fns';
interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
  onOrderAdded?: (quantity: number) => void;
  isAutoPrintEnabled?: boolean;
  facebookPostId?: string; // ✅ Received from parent to avoid cascade queries
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
  onOrderAdded,
  isAutoPrintEnabled = false,
  facebookPostId // ✅ Received from parent
}: QuickAddOrderProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addJob: addPrintJob } = usePrintQueue();

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
    enabled: !!phaseId && phaseId !== 'all'
  });

  // ✅ Removed cascade query - facebook_post_id now received from parent

  // Fetch existing orders and count usage per comment
  const {
    data: existingOrders = []
  } = useQuery({
    queryKey: ['live-orders', phaseId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('live_orders').select('session_index, facebook_comment_id').eq('live_phase_id', phaseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId
  });

  // Fetch facebook_pending_orders for the phase date (include order_count)
  const {
    data: pendingOrders = []
  } = useQuery({
    queryKey: ['facebook-pending-orders', phaseData?.phase_date, facebookPostId],
    queryFn: async () => {
      if (!phaseData?.phase_date) return [];
      
      let query: any = supabase
        .from('facebook_pending_orders')
        .select('*, order_count');
      
      // PRIORITY: Filter by facebook_post_id if available
      if (facebookPostId) {
        console.log('🎯 [QUICK ADD] Filtering by facebook_post_id:', facebookPostId);
        query = query.eq('facebook_post_id', facebookPostId);
      } else {
        // FALLBACK: Filter by date (backward compatibility)
        console.warn('⚠️ [QUICK ADD] No facebook_post_id, filtering by date');
        query = query.gte('created_time', `${phaseData.phase_date}T00:00:00`);
        query = query.lt('created_time', `${phaseData.phase_date}T23:59:59`);
      }
      
      query = query.order('created_time', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []) as PendingOrder[];
    },
    enabled: !!phaseData?.phase_date,
    staleTime: 10000, // ✅ Cache 10s to prevent refetch on every keystroke
  });

  // ✅ LOCAL realtime subscription for facebook_pending_orders (filtered by video)
  useEffect(() => {
    if (!facebookPostId) {
      console.warn('⚠️ [REALTIME QuickAdd] No facebookPostId, skipping subscription');
      return;
    }

    console.log('🔔 [REALTIME QuickAdd] Setting up subscription for facebook_post_id:', facebookPostId);

    const channel = supabase
      .channel(`facebook_pending_orders:${facebookPostId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'facebook_pending_orders',
          filter: `facebook_post_id=eq.${facebookPostId}` // ✅ Only listen to this video
        },
        (payload) => {
          console.log('📡 [REALTIME QuickAdd] facebook_pending_orders changed:', payload);
          
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['facebook-pending-orders', phaseData?.phase_date, facebookPostId]
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME QuickAdd] Subscription status:', status);
      });

    // Cleanup on unmount or when facebookPostId changes
    return () => {
      console.log('🔕 [REALTIME QuickAdd] Cleaning up subscription for:', facebookPostId);
      supabase.removeChannel(channel);
    };
  }, [facebookPostId, phaseData?.phase_date, queryClient]);

  // ✅ Data will be refetched ON-DEMAND when dropdown is opened (see Popover onOpenChange)

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
      try {
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
          session_index: parseInt(sessionIndex),
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
      } catch (error) {
        console.error('❌ Error in addOrderMutation:', error);
        throw error;
      }
    },

    // ✅ OPTIMISTIC UPDATE: Update UI immediately before backend
    onMutate: async ({ sessionIndex, commentId }) => {
      console.log('⚡ [OPTIMISTIC] Adding order immediately to UI...');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['live-orders', phaseId] });
      await queryClient.cancelQueries({ queryKey: ['live-products', phaseId] });
      await queryClient.cancelQueries({ queryKey: ['orders-with-products', phaseId] });

      // Snapshot previous state for rollback
      const previousOrders = queryClient.getQueryData(['live-orders', phaseId]);
      const previousProducts = queryClient.getQueryData(['live-products', phaseId]);
      const previousOrdersWithProducts = queryClient.getQueryData(['orders-with-products', phaseId]);

      // ✅ UPDATE UI: Add temporary order to cache
      queryClient.setQueryData(['live-orders', phaseId], (old: any) => {
        const newOrder = {
          id: `temp-${Date.now()}`,
          session_index: parseInt(sessionIndex),
          facebook_comment_id: commentId === 'MANUAL_ENTRY' ? null : commentId,
          live_phase_id: phaseId,
          live_product_id: productId,
          quantity: 1,
          is_optimistic: true,
        };
        return [...(old || []), newOrder];
      });

      // ✅ UPDATE SOLD QUANTITY immediately
      queryClient.setQueryData(['live-products', phaseId], (old: any) => {
        return (old || []).map((product: any) =>
          product.id === productId
            ? { ...product, sold_quantity: (product.sold_quantity || 0) + 1 }
            : product
        );
      });

      // Show immediate toast
      toast({
        title: "⚡ Đang xử lý...",
        description: `Đã thêm đơn ${sessionIndex} vào UI`,
      });

      return { previousOrders, previousProducts, previousOrdersWithProducts };
    },
    // ✅ SUCCESS: Backend successful, sync with DB
    onSuccess: async ({
      sessionIndex,
      isOversell,
      billData
    }) => {
      console.log('✅ [BACKEND] Order added successfully, syncing with DB...');
      
      setInputValue('');
      onOrderAdded?.(1);
      
      // Invalidate to refetch and sync with DB (replace temporary order with real one)
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
        queryKey: ['facebook-pending-orders', phaseData?.phase_date, facebookPostId]
      });

      // Auto-print bill using saved printer configuration (if enabled)
      if (billData && isAutoPrintEnabled) {
        const activePrinter = await getActivePrinter();
        if (activePrinter) {
          try {
            console.log(`🖨️ Auto-printing bill for order #${billData.sessionIndex}...`);
            
            // Load saved printer settings
            const { loadFormatSettings, generatePrintHTML } = await import('@/lib/printer-config-utils');
            const savedSettings = await loadFormatSettings();
            
            // Parse settings with defaults
            const width = savedSettings?.width === 'custom' 
              ? parseInt(savedSettings.customWidth) || 576
              : parseInt(savedSettings?.width || '576');
            
            const height = savedSettings?.height === 'custom'
              ? parseInt(savedSettings.customHeight) || null
              : savedSettings?.height === 'auto' 
                ? null 
                : parseInt(savedSettings?.height || '0') || null;
            
            const threshold = parseInt(savedSettings?.threshold || '95');
            const scale = parseFloat(savedSettings?.scale || '2');
            
            // Font settings
            const fontSession = parseInt(savedSettings?.fontSession || '72');
            const fontPhone = parseInt(savedSettings?.fontPhone || '52');
            const fontCustomer = parseInt(savedSettings?.fontCustomer || '52');
            const fontProduct = parseInt(savedSettings?.fontProduct || '36');
            const fontComment = parseInt(savedSettings?.fontComment || '32');
            const padding = parseInt(savedSettings?.padding || '20');
            const lineSpacing = parseInt(savedSettings?.lineSpacing || '12');
            const alignment = savedSettings?.alignment || 'center';
            const isBold = savedSettings?.isBold ?? true;
            const isItalic = savedSettings?.isItalic ?? false;
            
            console.log('📐 Using printer settings:', {
              width, height, threshold, scale,
              fontSession, fontPhone, fontCustomer, fontProduct,
              padding, lineSpacing, alignment, isBold, isItalic
            });
            
            // Generate HTML with full format settings
            const billHTML = generatePrintHTML(
              {
                width,
                height,
                threshold,
                scale,
                fontSession,
                fontPhone,
                fontCustomer,
                fontProduct,
                fontComment,
                padding,
                lineSpacing,
                alignment,
                isBold,
                isItalic
              },
              {
                sessionIndex: billData.sessionIndex,
                phone: billData.phone || '',
                customerName: billData.customerName || '',
                productCode: billData.productCode || '',
                productName: billData.productName || '',
                comment: billData.comment || ''
              }
            );
            
            console.log('✅ HTML generated with custom settings');
            
            // Add to print queue instead of direct printing
            addPrintJob({
              printer: activePrinter,
              html: billHTML,
              settings: { width, height, threshold, scale },
              priority: 'normal',
              metadata: {
                sessionIndex: billData.sessionIndex,
                customerName: billData.customerName || '',
                productCode: billData.productCode || ''
              },
              callbacks: {
                onSuccess: () => {
                  console.log("✅ Bill printed successfully from queue");
                },
                onError: (job, error) => {
                  console.error('❌ Print job failed:', error);
                  toast({
                    title: "❌ Lỗi in bill",
                    description: error,
                    variant: "destructive"
                  });
                }
              }
            });

            toast({
              title: "📋 Đã thêm vào hàng đợi in",
              description: `Đơn hàng #${billData.sessionIndex}`,
            });
            
          } catch (error) {
            console.error('❌ Auto-print error:', error);
            toast({
              title: "⚠️ Lỗi in bill tự động",
              description: error instanceof Error ? error.message : "Unknown error",
              variant: "destructive"
            });
          }
        } else {
          // Fallback: Browser print dialog nếu không có máy in active
          console.log("⚠️ No active printer found, using browser dialog");
          const billHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                @page {
                  margin: 2mm;
                }
                body { 
                  margin: 0; 
                  padding: 2mm; 
                  font-family: Tahoma, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                }
                .bill-container {
                  display: flex;
                  flex-direction: column;
                  gap: 2mm;
                  text-align: center;
                  width: 100%;
                }
                .line1 {
                  font-size: 28pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line1 .phone {
                  font-size: 18pt;
                  font-weight: bold;
                }
                .line2 {
                  font-size: 28pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line3 {
                  font-size: 14pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line4 {
                  font-size: 28pt;
                  font-weight: bold;
                  font-style: italic;
                  line-height: 1.2;
                }
                .line5 {
                  font-size: 7pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
              </style>
            </head>
            <body>
              <div class="bill-container">
                <div class="line1">#${billData.sessionIndex} - <span class="phone">${billData.phone || 'Chưa có SĐT'}</span></div>
                <div class="line2">${billData.customerName}</div>
                <div class="line3">${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}</div>
                ${billData.comment ? `<div class="line4">${billData.comment}</div>` : ''}
                <div class="line5">${new Date(billData.createdTime).toLocaleString('vi-VN', {
            timeZone: 'Asia/Bangkok',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</div>
              </div>
            </body>
            </html>
          `;
          const printWindow = window.open('', '_blank', 'width=400,height=600');
          if (printWindow) {
            printWindow.document.write(billHtml);
            printWindow.document.close();
            printWindow.focus();
            printWindow.onload = () => {
              printWindow.print();
            };
          }
        }
      } else if (billData && !isAutoPrintEnabled) {
        console.log('⏩ Auto-print skipped (disabled by user)');
      }
      const isManualEntry = !billData;
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "✅ Thành công",
        description: isOversell 
          ? `Đơn ${sessionIndex} đã được thêm (vượt số lượng)${isManualEntry ? ' (nhập tay)' : ''}`
          : `Đơn hàng ${sessionIndex} đã được lưu${isManualEntry ? ' (nhập tay)' : ''}`,
        variant: isOversell ? "destructive" : "default"
      });
    },

    // ❌ ERROR: Backend failed, rollback UI
    onError: (error, variables, context) => {
      console.error('❌ [BACKEND] Error, rolling back UI...', error);

      // Rollback all changes
      if (context?.previousOrders) {
        queryClient.setQueryData(['live-orders', phaseId], context.previousOrders);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(['live-products', phaseId], context.previousProducts);
      }
      if (context?.previousOrdersWithProducts) {
        queryClient.setQueryData(['orders-with-products', phaseId], context.previousOrdersWithProducts);
      }

      toast({
        title: "❌ Lỗi",
        description: error instanceof Error ? error.message : "Không thể thêm đơn hàng. Đã hoàn tác.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always reset loading state after mutation completes (success or error)
      console.log('✅ Order mutation settled');
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
      <Popover open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        
        // ✅ Refetch data khi MỞ dropdown
        if (open && phaseData?.phase_date) {
          console.log('🔄 [QUICK ADD] Refetching facebook_pending_orders for phase_date:', phaseData.phase_date);
          queryClient.invalidateQueries({
            queryKey: ['facebook-pending-orders', phaseData.phase_date, facebookPostId]
          });
        }
      }}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={handleKeyPress} onClick={() => setIsOpen(true)} placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."} className={cn("text-sm h-9", isOutOfStock && "border-red-500")} />
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
      
      <Button onClick={handleAddOrder} disabled={!inputValue.trim()} size="sm" className="h-9">
        <Plus className="h-4 w-4" />
      </Button>
    </div>;
}