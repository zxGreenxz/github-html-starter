-- STEP 1: Add product_id column to purchase_order_items
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE RESTRICT;

-- Create index for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id 
ON purchase_order_items(product_id);

-- STEP 2: Migrate existing data - Map product_id from product_code
UPDATE purchase_order_items poi
SET product_id = p.id
FROM products p
WHERE poi.product_code = p.product_code
  AND poi.product_id IS NULL;

-- STEP 3: Create products for items without product_id (using subquery to avoid duplicates)
INSERT INTO products (
  product_code, 
  product_name, 
  variant, 
  purchase_price, 
  selling_price,
  stock_quantity,
  supplier_name,
  product_images,
  price_images,
  base_product_code
)
SELECT DISTINCT ON (poi.product_code)
  poi.product_code,
  poi.product_name,
  poi.variant,
  COALESCE(poi.unit_price, 0),
  COALESCE(poi.selling_price, 0),
  0,
  po.supplier_name,
  poi.product_images,
  poi.price_images,
  poi.base_product_code
FROM purchase_order_items poi
JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE poi.product_id IS NULL
  AND poi.product_code IS NOT NULL
  AND poi.product_code != ''
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.product_code = poi.product_code
  )
ORDER BY poi.product_code, poi.created_at DESC;

-- Update product_id after inserting new products
UPDATE purchase_order_items poi
SET product_id = p.id
FROM products p
WHERE poi.product_code = p.product_code
  AND poi.product_id IS NULL;

-- STEP 4: Drop duplicate columns from purchase_order_items
ALTER TABLE purchase_order_items 
DROP COLUMN IF EXISTS product_code,
DROP COLUMN IF EXISTS product_name,
DROP COLUMN IF EXISTS variant,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS product_images,
DROP COLUMN IF EXISTS price_images,
DROP COLUMN IF EXISTS unit_price,
DROP COLUMN IF EXISTS selling_price,
DROP COLUMN IF EXISTS total_price,
DROP COLUMN IF EXISTS base_product_code;

-- STEP 5: Set product_id to NOT NULL
ALTER TABLE purchase_order_items 
ALTER COLUMN product_id SET NOT NULL;