-- Safe deletion of duplicate products: Keep earliest created, delete later ones
-- This will handle all 151 duplicate product_codes

DO $$
DECLARE
  v_duplicate_code TEXT;
  v_keep_id UUID;
  v_delete_id UUID;
  v_keep_stock INTEGER;
  v_delete_stock INTEGER;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Loop through each duplicate product_code
  FOR v_duplicate_code IN
    SELECT product_code
    FROM products
    GROUP BY product_code
    HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the product to KEEP (earliest created_at)
    SELECT id, stock_quantity INTO v_keep_id, v_keep_stock
    FROM products
    WHERE product_code = v_duplicate_code
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Get the ID of the product to DELETE (latest created_at)
    SELECT id, stock_quantity INTO v_delete_id, v_delete_stock
    FROM products
    WHERE product_code = v_duplicate_code
    AND id != v_keep_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Backup the duplicate before deletion
    INSERT INTO products_cleanup_backup (
      id, product_code, product_name, variant, stock_quantity,
      selling_price, purchase_price, supplier_name, tpos_product_id,
      product_images, price_images, reason
    )
    SELECT 
      id, product_code, product_name, variant, stock_quantity,
      selling_price, purchase_price, supplier_name, tpos_product_id,
      product_images, price_images,
      'Duplicate - deleted later created record (created_at: ' || created_at::text || ')'
    FROM products
    WHERE id = v_delete_id;

    -- Update foreign key references in goods_receiving_items
    UPDATE goods_receiving_items
    SET product_code = v_duplicate_code
    WHERE product_code = v_duplicate_code;

    -- Update foreign key references in purchase_order_items
    UPDATE purchase_order_items
    SET product_id = v_keep_id
    WHERE product_id = v_delete_id;

    -- Update foreign key references in live_products (if product_code matches)
    UPDATE live_products
    SET product_code = v_duplicate_code
    WHERE product_code = v_duplicate_code;

    -- Merge stock quantities (add delete stock to keep stock)
    UPDATE products
    SET 
      stock_quantity = v_keep_stock + COALESCE(v_delete_stock, 0),
      updated_at = now()
    WHERE id = v_keep_id;

    -- Delete the duplicate (later created record)
    DELETE FROM products WHERE id = v_delete_id;

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RAISE NOTICE 'Deleted % duplicate products (kept earliest created)', v_deleted_count;
END $$;