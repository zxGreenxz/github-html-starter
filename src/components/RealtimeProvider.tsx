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
      // Live session ecosystem
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
        queryClient.invalidateQueries({ queryKey: ["live-products"] });
        queryClient.invalidateQueries({ queryKey: ["live-orders"] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_phases" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-phases"] });
        queryClient.invalidateQueries({ queryKey: ["live-products"] });
        queryClient.invalidateQueries({ queryKey: ["live-orders"] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-products"] });
        queryClient.invalidateQueries({ queryKey: ["live-orders"] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-orders"] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
        queryClient.invalidateQueries({ queryKey: ["upload-tpos-orders"] });
      })
      // Facebook integration
      .on("postgres_changes", { event: "*", schema: "public", table: "facebook_pages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["facebook-pages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "facebook_pending_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["facebook-pending-orders"] });
        queryClient.invalidateQueries({ queryKey: ["tpos-orders"] });
        queryClient.invalidateQueries({ queryKey: ["facebook-comments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "facebook_comments_archive" }, () => {
        queryClient.invalidateQueries({ queryKey: ["facebook-comments"] });
      })
      // Customers & reports & activity logs
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "livestream_reports" }, () => {
        queryClient.invalidateQueries({ queryKey: ["livestream-reports"] });
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