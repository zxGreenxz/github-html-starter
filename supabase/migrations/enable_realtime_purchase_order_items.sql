-- ✅ Enable Realtime for purchase_order_items table
-- This allows frontend to subscribe to real-time changes

-- Step 1: Set replica identity to FULL (required for Realtime to include old/new values)
ALTER TABLE purchase_order_items REPLICA IDENTITY FULL;

-- Step 2: Add table to Realtime publication (if not already added)
-- This makes the table available for Realtime subscriptions
-- ✅ Idempotent: Only add if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'purchase_order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE purchase_order_items;
  END IF;
END $$;

-- Verify configuration
-- Run this to check if table is in publication:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_order_items';
