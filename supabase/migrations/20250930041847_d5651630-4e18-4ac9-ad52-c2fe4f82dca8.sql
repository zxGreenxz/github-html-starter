-- Add selling_price column to purchase_order_items table
ALTER TABLE public.purchase_order_items 
ADD COLUMN selling_price NUMERIC DEFAULT 0;