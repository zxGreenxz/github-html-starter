-- Add product_codes column to facebook_pending_orders
-- This stores an array of product codes (e.g., ['N217', 'N236L', 'N55']) 
-- extracted from comment messages when creating orders

ALTER TABLE facebook_pending_orders
ADD COLUMN IF NOT EXISTS product_codes TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN facebook_pending_orders.product_codes 
IS 'Array of product codes selected for this pending order, extracted from comment message';

-- Create GIN index for fast array searches (e.g., WHERE 'N217' = ANY(product_codes))
CREATE INDEX IF NOT EXISTS idx_facebook_pending_orders_product_codes 
ON facebook_pending_orders USING GIN (product_codes);

-- Verify the column was added successfully
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'facebook_pending_orders' 
AND column_name = 'product_codes';