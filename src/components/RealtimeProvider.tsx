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