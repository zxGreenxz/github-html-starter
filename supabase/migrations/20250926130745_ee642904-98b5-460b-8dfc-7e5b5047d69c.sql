-- Add supplier_name column to purchase_orders table to support manual supplier entry
ALTER TABLE public.purchase_orders 
ADD COLUMN supplier_name TEXT;

-- Make supplier_id nullable since we now support manual supplier names
ALTER TABLE public.purchase_orders 
ALTER COLUMN supplier_id DROP NOT NULL;