-- Add unique constraint to facebook_id column in customers table
-- This allows upsert operations based on facebook_id

ALTER TABLE public.customers 
ADD CONSTRAINT customers_facebook_id_unique UNIQUE (facebook_id);