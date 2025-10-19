-- PURCHASE ORDERS REFACTOR V2: Complete Decoupling from Products Table
-- This migration removes product_id and makes snapshot fields the primary data

-- Step 1: Drop trigger first, then the function
DROP TRIGGER IF EXISTS trigger_update_product_stock ON goods_receiving_items;
DROP FUNCTION IF EXISTS update_product_stock_on_receiving();

-- Step 2: Drop foreign key constraint and product_id column
ALTER TABLE purchase_order_items 
DROP CONSTRAINT IF EXISTS purchase_order_items_product_id_fkey;

ALTER TABLE purchase_order_items 
DROP COLUMN IF EXISTS product_id;

-- Step 3: Handle NULL values before renaming (set defaults from old data structure)
-- Update NULL snapshot values with placeholder data
UPDATE purchase_order_items
SET 
  product_code_snapshot = COALESCE(product_code_snapshot, 'UNKNOWN'),
  product_name_snapshot = COALESCE(product_name_snapshot, 'Sản phẩm không xác định'),
  purchase_price_snapshot = COALESCE(purchase_price_snapshot, 0),
  selling_price_snapshot = COALESCE(selling_price_snapshot, 0)
WHERE 
  product_code_snapshot IS NULL 
  OR product_name_snapshot IS NULL
  OR purchase_price_snapshot IS NULL
  OR selling_price_snapshot IS NULL;

-- Step 4: Rename snapshot columns to primary names
ALTER TABLE purchase_order_items 
RENAME COLUMN product_code_snapshot TO product_code;

ALTER TABLE purchase_order_items 
RENAME COLUMN product_name_snapshot TO product_name;

ALTER TABLE purchase_order_items 
RENAME COLUMN variant_snapshot TO variant;

ALTER TABLE purchase_order_items 
RENAME COLUMN purchase_price_snapshot TO purchase_price;

ALTER TABLE purchase_order_items 
RENAME COLUMN selling_price_snapshot TO selling_price;

ALTER TABLE purchase_order_items 
RENAME COLUMN product_images_snapshot TO product_images;

ALTER TABLE purchase_order_items 
RENAME COLUMN price_images_snapshot TO price_images;

-- Step 5: Set NOT NULL constraints for required fields
ALTER TABLE purchase_order_items 
ALTER COLUMN product_code SET NOT NULL;

ALTER TABLE purchase_order_items 
ALTER COLUMN product_name SET NOT NULL;

ALTER TABLE purchase_order_items 
ALTER COLUMN purchase_price SET NOT NULL;

ALTER TABLE purchase_order_items 
ALTER COLUMN selling_price SET NOT NULL;