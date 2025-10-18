-- Migration: Create pending_live_orders queue table
-- Purpose: Decouple fast comment capture from slower product matching
-- Benefits: Non-blocking, retry mechanism, audit trail
-- Run this migration in Supabase SQL Editor

-- Drop table if exists (clean slate)
DROP TABLE IF EXISTS public.pending_live_orders CASCADE;

-- Create pending_live_orders table
CREATE TABLE public.pending_live_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_comment_id TEXT NOT NULL UNIQUE,
  comment_text TEXT,
  customer_name TEXT,
  session_index TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Index for querying unprocessed orders efficiently
CREATE INDEX idx_pending_live_orders_processed 
  ON public.pending_live_orders (processed) 
  WHERE processed = FALSE;

-- Index for timestamp queries
CREATE INDEX idx_pending_live_orders_created_at 
  ON public.pending_live_orders (created_at);

-- Enable Row Level Security
ALTER TABLE public.pending_live_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view pending orders
CREATE POLICY "Allow authenticated users to view pending orders"
  ON public.pending_live_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow service_role full access (for edge functions)
CREATE POLICY "Allow service_role full access"
  ON public.pending_live_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime for this table
ALTER TABLE public.pending_live_orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_live_orders;

-- Verify table creation
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'pending_live_orders';
