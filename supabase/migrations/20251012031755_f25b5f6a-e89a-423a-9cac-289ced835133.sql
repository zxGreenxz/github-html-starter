-- Enable realtime for facebook_pending_orders table
ALTER TABLE public.facebook_pending_orders REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_pending_orders;