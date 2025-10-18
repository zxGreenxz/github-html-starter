-- Add variant column to purchase_order_items table
ALTER TABLE public.purchase_order_items 
ADD COLUMN variant TEXT;