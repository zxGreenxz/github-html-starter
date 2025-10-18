-- Enable realtime for live_products related tables
ALTER TABLE live_products REPLICA IDENTITY FULL;
ALTER TABLE live_orders REPLICA IDENTITY FULL;
ALTER TABLE live_sessions REPLICA IDENTITY FULL;
ALTER TABLE live_phases REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE live_products;
ALTER PUBLICATION supabase_realtime ADD TABLE live_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE live_phases;