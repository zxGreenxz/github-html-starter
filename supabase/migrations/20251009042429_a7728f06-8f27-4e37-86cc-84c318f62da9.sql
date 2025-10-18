-- Add note column to live_products table
ALTER TABLE public.live_products 
ADD COLUMN note TEXT;