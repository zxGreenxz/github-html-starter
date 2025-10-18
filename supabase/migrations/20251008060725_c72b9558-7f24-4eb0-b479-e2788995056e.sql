-- Add base_product_code column to products table
ALTER TABLE public.products
ADD COLUMN base_product_code TEXT;

-- Create index for better query performance
CREATE INDEX idx_products_base_product_code ON public.products(base_product_code);

-- Add comment to explain the column
COMMENT ON COLUMN public.products.base_product_code IS 'The root product code for variant products. Used to group related variants together.';