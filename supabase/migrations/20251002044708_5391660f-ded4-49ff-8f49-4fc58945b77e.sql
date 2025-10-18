-- Add position field to purchase_order_items
ALTER TABLE public.purchase_order_items 
ADD COLUMN position integer;

-- Backfill position for existing items based on created_at
WITH ranked_items AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY purchase_order_id ORDER BY created_at ASC) as row_num
  FROM public.purchase_order_items
)
UPDATE public.purchase_order_items
SET position = ranked_items.row_num
FROM ranked_items
WHERE purchase_order_items.id = ranked_items.id;

-- Make position NOT NULL after backfill
ALTER TABLE public.purchase_order_items 
ALTER COLUMN position SET NOT NULL;

-- Set default for new items
ALTER TABLE public.purchase_order_items 
ALTER COLUMN position SET DEFAULT 1;