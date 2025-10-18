-- Add variant column to live_products table
ALTER TABLE public.live_products 
ADD COLUMN variant TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.live_products.variant IS 'Product variant/variation (e.g., size, color, style)';