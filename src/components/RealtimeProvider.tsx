import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RealtimeProvider() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("global-realtime")
      // Products and suppliers
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["products-search"] });
        queryClient.invalidateQueries({ queryKey: ["products-total-count"] });
        queryClient.invalidateQueries({ queryKey: ["products-stats"] });
        queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      })
      // Purchase & receiving
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_order_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["purchase-order-items"] });
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "goods_receiving" }, () => {
        queryClient.invalidateQueries({ queryKey: ["goods-receiving"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "goods_receiving_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["goods-receiving-items"] });
        queryClient.invalidateQueries({ queryKey: ["goods-receiving"] });
      })
      // ❌ REMOVED: live_* tables now use LOCAL filtered subscriptions in LiveProducts.tsx
      // This prevents unnecessary refetches for all sessions when only one is active
      // Purchase order items sync status (realtime instead of polling)
      .on("postgres_changes", { 
        event: "UPDATE", 
        schema: "public", 
        table: "purchase_order_items"
      }, (payload) => {
        // ✅ STEP 3: Extract purchase_order_id for selective refetch
        const purchaseOrderId = payload.new?.purchase_order_id;
        
        if (purchaseOrderId) {
          console.log(`📡 Realtime: purchase_order_item updated for order ${purchaseOrderId}`);
          
          // 🎯 ONLY invalidate queries for THIS specific order
          queryClient.invalidateQueries({ 
            queryKey: ["order-sync-status"], 
            exact: false // Allow partial match
          });
          
          // ✅ Refetch ONLY the affected order's items (not the whole table)
          queryClient.invalidateQueries({ 
            queryKey: ["purchase-order-items", purchaseOrderId],
            exact: true 
          });
        } else {
          // Fallback: If no purchaseOrderId, invalidate all (shouldn't happen)
          queryClient.invalidateQueries({ queryKey: ["order-sync-status"] });
        }
      })
      // Customers & activity logs
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}

export default RealtimeProvider;