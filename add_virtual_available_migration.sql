-- Add virtual_available column to products table
-- Run this migration in Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS virtual_available INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN products.virtual_available IS 'Virtual available quantity from TPOS (forecast stock)';
