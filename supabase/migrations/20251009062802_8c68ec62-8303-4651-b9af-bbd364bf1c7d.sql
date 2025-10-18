-- Add base_product_code column to live_products table
ALTER TABLE public.live_products 
ADD COLUMN base_product_code text;

-- Create index for better query performance
CREATE INDEX idx_live_products_base_code 
ON public.live_products(base_product_code);

-- Add comment for documentation
COMMENT ON COLUMN public.live_products.base_product_code IS 'Base product code for grouping variants together. Null for manually added products.';