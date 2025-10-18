-- Drop old unique constraint on product_code only
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_code_key;

-- Add composite unique constraint on (product_code, variant)
-- This allows multiple variants for the same product_code
ALTER TABLE public.products ADD CONSTRAINT products_product_code_variant_key 
  UNIQUE (product_code, variant);