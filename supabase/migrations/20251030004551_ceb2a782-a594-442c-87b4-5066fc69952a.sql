-- Drop old constraint
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Add new constraint with awaiting_export status
ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'awaiting_export'::text, 'pending'::text, 'received'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]));