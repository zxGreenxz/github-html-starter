-- Add price_images column to purchase_order_items table
ALTER TABLE public.purchase_order_items 
ADD COLUMN price_images TEXT[];