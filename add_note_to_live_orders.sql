-- Add note column to live_orders table
-- Run this in Supabase SQL Editor

ALTER TABLE public.live_orders 
ADD COLUMN note TEXT;

COMMENT ON COLUMN live_orders.note IS 'Product-level note for each order item';
