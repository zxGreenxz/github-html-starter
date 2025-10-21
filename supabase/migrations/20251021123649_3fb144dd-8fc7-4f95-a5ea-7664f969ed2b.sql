-- Add variant_metadata column to products table for storing TPOSAttributeLine[]
-- This enables exact regeneration of variants and TPOS upload compatibility
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_metadata JSONB;

-- Add GIN index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_products_variant_metadata 
ON products USING gin (variant_metadata);

-- Add comment explaining the column purpose
COMMENT ON COLUMN products.variant_metadata IS 'Stores TPOSAttributeLine[] array from variant-generator.ts for TPOS upload compatibility and exact variant regeneration';
