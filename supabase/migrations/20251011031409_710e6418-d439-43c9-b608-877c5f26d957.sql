-- Add shipping_fee column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS shipping_fee bigint DEFAULT 0;