-- Step 1: Create backup table for any duplicate records
CREATE TABLE IF NOT EXISTS products_duplicate_cleanup AS 
SELECT * FROM products 
WHERE (product_code, COALESCE(variant, '')) IN (
  SELECT product_code, COALESCE(variant, '')
  FROM products
  GROUP BY product_code, COALESCE(variant, '')
  HAVING COUNT(*) > 1
);

-- Step 2: Delete duplicate records (keep the oldest one based on created_at)
DELETE FROM products p1
WHERE EXISTS (
  SELECT 1 FROM products p2
  WHERE p1.product_code = p2.product_code
    AND COALESCE(p1.variant, '') = COALESCE(p2.variant, '')
    AND p1.created_at > p2.created_at
);

-- Step 3: Drop the old UNIQUE constraint on (product_code, variant)
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_product_code_variant_key;

-- Step 4: Create new UNIQUE constraint on product_code only
ALTER TABLE products 
ADD CONSTRAINT products_product_code_key UNIQUE (product_code);

-- Step 5: Create index to improve query performance
CREATE INDEX IF NOT EXISTS idx_products_product_code 
ON products(product_code);

-- Step 6: Update the function to use new constraint
CREATE OR REPLACE FUNCTION public.update_product_stock_on_receiving()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase_order RECORD;
  v_product RECORD;
BEGIN
  -- Get supplier name from purchase order
  SELECT po.supplier_name
  INTO v_purchase_order
  FROM goods_receiving gr
  JOIN purchase_orders po ON po.id = gr.purchase_order_id
  WHERE gr.id = NEW.goods_receiving_id
  LIMIT 1;

  -- Get product details from products table via purchase_order_items.product_id
  SELECT 
    p.product_code,
    p.product_name,
    p.variant,
    p.selling_price,
    p.purchase_price,
    p.unit,
    p.product_images,
    p.price_images,
    p.tpos_product_id
  INTO v_product
  FROM purchase_order_items poi
  LEFT JOIN products p ON p.id = poi.product_id
  WHERE poi.id = NEW.purchase_order_item_id
  LIMIT 1;

  -- Upsert product with priority: NEW record -> products table -> defaults
  INSERT INTO public.products (
    product_code,
    product_name,
    variant,
    selling_price,
    purchase_price,
    unit,
    stock_quantity,
    supplier_name,
    product_images,
    price_images,
    tpos_product_id
  )
  VALUES (
    COALESCE(NEW.product_code, v_product.product_code),
    COALESCE(NEW.product_name, v_product.product_name),
    COALESCE(NEW.variant, v_product.variant),
    COALESCE(v_product.selling_price, 0),
    COALESCE(v_product.purchase_price, 0),
    COALESCE(v_product.unit, 'Cái'),
    NEW.received_quantity,
    v_purchase_order.supplier_name,
    v_product.product_images,
    v_product.price_images,
    v_product.tpos_product_id
  )
  ON CONFLICT (product_code)
  DO UPDATE SET
    stock_quantity = products.stock_quantity + NEW.received_quantity,
    product_name = COALESCE(EXCLUDED.product_name, products.product_name),
    variant = COALESCE(EXCLUDED.variant, products.variant),
    selling_price = COALESCE(EXCLUDED.selling_price, products.selling_price),
    purchase_price = COALESCE(EXCLUDED.purchase_price, products.purchase_price),
    tpos_product_id = COALESCE(products.tpos_product_id, EXCLUDED.tpos_product_id),
    updated_at = now();

  RETURN NEW;
END;
$function$;