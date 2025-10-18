-- Add productid_bienthe column to products table for TPOS variant ID
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS productid_bienthe INTEGER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_productid_bienthe ON products(productid_bienthe);

-- Add comment
COMMENT ON COLUMN products.productid_bienthe IS 'TPOS Product variant ID (biến thể) from TPOS odata/Product API';