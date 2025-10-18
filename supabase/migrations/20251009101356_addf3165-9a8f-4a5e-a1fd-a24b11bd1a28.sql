-- Add unique constraint on facebook_id for customers table
-- Use a partial unique index to allow multiple NULL values but enforce uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS customers_facebook_id_key 
ON public.customers (facebook_id) 
WHERE facebook_id IS NOT NULL;