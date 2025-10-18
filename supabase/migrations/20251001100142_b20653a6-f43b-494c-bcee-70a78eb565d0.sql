-- Add image_url column to live_products table
ALTER TABLE public.live_products 
ADD COLUMN image_url TEXT;