import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, Calendar } from "lucide-react";
import { GoodsReceivingStats } from "@/components/goods-receiving/GoodsReceivingStats";
import { GoodsReceivingList } from "@/components/goods-receiving/GoodsReceivingList";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusFilter = "needInspection" | "inspected" | "shortage" | "all";

export default function GoodsReceiving() {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needInspection");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['goods-receiving-orders', statusFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          items:purchase_order_items(
            id,
            quantity,
            notes,
            product_code,
            product_name,
            variant,
            purchase_price,
            selling_price,
            product_images,
            price_images
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date filters
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data: purchaseOrders } = await query;

      // Get receiving records with detailed items for each order
      const ordersWithStatus = await Promise.all(
        (purchaseOrders || []).map(async (order) => {
          const { data: receiving } = await supabase
            .from('goods_receiving')
            .select(`
              *,
              receiving_date,
              items:goods_receiving_items(
                discrepancy_type,
                discrepancy_quantity
              )
            `)
            .eq('purchase_order_id', order.id)
            .maybeSingle();
          
          // Calculate overall status
          let overallStatus = 'match';
          if (receiving?.items && receiving.items.length > 0) {
            const hasShortage = receiving.items.some((item: any) => item.discrepancy_type === 'shortage');
            const hasOverage = receiving.items.some((item: any) => item.discrepancy_type === 'overage');
            
            if (hasShortage) {
              overallStatus = 'shortage';
            } else if (hasOverage) {
              overallStatus = 'overage';
            }
          }

          return { 
            ...order, 
            receiving,
            hasReceiving: !!receiving,
            overallStatus
          };
        })
      );

      // Apply status filter
      let filteredOrders;
      if (statusFilter === "needInspection") {
        filteredOrders = ordersWithStatus.filter(o => (o.status === 'confirmed' || o.status === 'pending') && !o.hasReceiving);
      } else if (statusFilter === "inspected") {
        filteredOrders = ordersWithStatus.filter(o => o.hasReceiving);
      } else if (statusFilter === "shortage") {
        filteredOrders = ordersWithStatus.filter(o => o.hasReceiving && o.overallStatus === 'shortage');
      } else {
        filteredOrders = ordersWithStatus;
      }

      // Sort by receiving_date for orders that have been inspected
      // This applies to: inspected, shortage, and all filters
      if (statusFilter !== "needInspection") {
        filteredOrders.sort((a, b) => {
          // For orders with receiving_date, sort by that
          // For orders without receiving_date, sort by created_at
          const dateA = a.receiving?.receiving_date 
            ? new Date(a.receiving.receiving_date).getTime() 
            : new Date(a.created_at).getTime();
          const dateB = b.receiving?.receiving_date 
            ? new Date(b.receiving.receiving_date).getTime() 
            : new Date(b.created_at).getTime();
          return dateB - dateA; // Descending order (mới nhất lên trước)
        });
      }
      
      return filteredOrders;
    }
  });

  // Apply search filter
  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const matchSupplier = order.supplier_name?.toLowerCase().includes(query);
    const matchProduct = order.items?.some((item: any) => 
      item.product_name?.toLowerCase().includes(query) ||
      item.product_code?.toLowerCase().includes(query)
    );
    const matchDate = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm').includes(query);
    
    return matchSupplier || matchProduct || matchDate;
  }) || [];

  // Apply quick filters
  const applyQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    
    switch (filter) {
      case "today":
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        setStartDate(format(weekAgo, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        setStartDate(format(monthAgo, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "thisMonth":
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(format(firstDayThisMonth, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "lastMonth":
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(format(firstDayLastMonth, 'yyyy-MM-dd'));
        setEndDate(format(lastDayLastMonth, 'yyyy-MM-dd'));
        break;
      default:
        setStartDate("");
        setEndDate("");
    }
  };

  return (
    <div className={isMobile ? "space-y-4" : "container mx-auto py-6 space-y-6"}>
      {isMobile ? (
        <div className="px-4 py-3 bg-background border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal text-xs h-9",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  {startDate ? format(new Date(startDate), "dd/MM/yyyy") : <span>Từ ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate ? new Date(startDate) : undefined}
                  onSelect={(date) => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <span className="text-muted-foreground text-xs">-</span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal text-xs h-9",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  {endDate ? format(new Date(endDate), "dd/MM/yyyy") : <span>Đến ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate ? new Date(endDate) : undefined}
                  onSelect={(date) => setEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Kiểm hàng & nhận hàng</h1>
              <p className="text-muted-foreground">Quản lý kiểm tra và nhận hàng từ nhà cung cấp</p>
            </div>
          </div>
        </div>
      )}

      {!isMobile && <GoodsReceivingStats filteredOrders={filteredOrders} isLoading={isLoading} />}
      <GoodsReceivingList
        filteredOrders={filteredOrders}
        isLoading={isLoading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        applyQuickFilter={applyQuickFilter}
        refetch={refetch}
      />
    </div>
  );
}