-- Create backup table for deleted products
CREATE TABLE IF NOT EXISTS products_cleanup_backup (
  id uuid PRIMARY KEY,
  product_code text NOT NULL,
  product_name text NOT NULL,
  variant text,
  selling_price numeric,
  purchase_price numeric,
  stock_quantity integer,
  supplier_name text,
  product_images text[],
  price_images text[],
  tpos_product_id integer,
  deleted_at timestamp with time zone DEFAULT now(),
  reason text
);

-- Create temporary table for scoring and ranking products
CREATE TEMP TABLE temp_product_scores AS
SELECT 
  id,
  product_code,
  product_name,
  variant,
  selling_price,
  purchase_price,
  stock_quantity,
  supplier_name,
  product_images,
  price_images,
  tpos_product_id,
  created_at,
  -- Quality score calculation
  (CASE WHEN tpos_product_id IS NOT NULL THEN 20 ELSE 0 END +
   CASE WHEN product_images IS NOT NULL AND array_length(product_images, 1) > 0 THEN 10 ELSE 0 END +
   CASE WHEN selling_price > 0 THEN 5 ELSE 0 END +
   CASE WHEN purchase_price > 0 THEN 5 ELSE 0 END +
   CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 5 ELSE 0 END +
   CASE WHEN stock_quantity != 0 THEN 3 ELSE 0 END) as quality_score
FROM products;

-- Create temporary table for ranked products
CREATE TEMP TABLE temp_ranked_products AS
SELECT 
  *,
  ROW_NUMBER() OVER (
    PARTITION BY product_code 
    ORDER BY quality_score DESC, created_at ASC
  ) as rank,
  COUNT(*) OVER (PARTITION BY product_code) as duplicate_count
FROM temp_product_scores;

-- Create temporary table for records to delete (safe ones without FK references)
CREATE TEMP TABLE temp_records_to_delete AS
SELECT rp.id, rp.product_code, rp.stock_quantity
FROM temp_ranked_products rp
WHERE rp.rank > 1  -- Not the best record
  AND rp.duplicate_count > 1  -- Has duplicates
  -- Check no FK references
  AND NOT EXISTS (
    SELECT 1 FROM purchase_order_items poi WHERE poi.product_id = rp.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM live_products lp WHERE lp.product_code = rp.product_code AND lp.product_name = rp.product_name
  )
  AND NOT EXISTS (
    SELECT 1 FROM goods_receiving_items gri WHERE gri.product_code = rp.product_code
  );

-- Create temporary table for stock to merge
CREATE TEMP TABLE temp_stock_to_merge AS
SELECT 
  product_code,
  SUM(stock_quantity) as total_stock_to_add
FROM temp_records_to_delete
GROUP BY product_code;

-- Create temporary table for records to keep
CREATE TEMP TABLE temp_records_to_keep AS
SELECT id, product_code
FROM temp_ranked_products
WHERE rank = 1 AND duplicate_count > 1;

-- Backup records before deletion
INSERT INTO products_cleanup_backup (
  id, product_code, product_name, variant, selling_price, purchase_price,
  stock_quantity, supplier_name, product_images, price_images, tpos_product_id, reason
)
SELECT 
  p.id, p.product_code, p.product_name, p.variant, p.selling_price, p.purchase_price,
  p.stock_quantity, p.supplier_name, p.product_images, p.price_images, p.tpos_product_id,
  'Duplicate - Safe deletion (no FK references)'
FROM products p
INNER JOIN temp_records_to_delete rtd ON p.id = rtd.id;

-- Merge stock quantities into kept records
UPDATE products p
SET 
  stock_quantity = p.stock_quantity + COALESCE(stm.total_stock_to_add, 0),
  updated_at = now()
FROM temp_stock_to_merge stm
INNER JOIN temp_records_to_keep rtk ON rtk.product_code = stm.product_code
WHERE p.id = rtk.id;

-- Delete duplicate records (safe ones only)
DELETE FROM products
WHERE id IN (SELECT id FROM temp_records_to_delete);