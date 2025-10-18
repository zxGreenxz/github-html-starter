-- Add TPOS image URL and product ID columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tpos_image_url TEXT,
ADD COLUMN IF NOT EXISTS tpos_product_id INTEGER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_tpos_product_id ON public.products(tpos_product_id);

-- Update the receiving trigger to also copy tpos_product_id
CREATE OR REPLACE FUNCTION public.update_product_stock_on_receiving()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_item RECORD;
  v_purchase_order RECORD;
BEGIN
  -- Get purchase order item details
  SELECT poi.*, po.supplier_name
  INTO v_order_item
  FROM purchase_order_items poi
  JOIN purchase_orders po ON po.id = poi.purchase_order_id
  JOIN goods_receiving gr ON gr.purchase_order_id = po.id
  WHERE poi.id = NEW.purchase_order_item_id
    AND gr.id = NEW.goods_receiving_id
  LIMIT 1;

  -- Upsert product
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
    COALESCE(v_order_item.product_code, NEW.product_code),
    NEW.product_name,
    COALESCE(v_order_item.variant, NEW.variant),
    COALESCE(v_order_item.selling_price, 0),
    COALESCE(v_order_item.unit_price, 0),
    COALESCE(v_order_item.description, 'Cái'),
    NEW.received_quantity,
    v_order_item.supplier_name,
    v_order_item.product_images,
    v_order_item.price_images,
    v_order_item.tpos_product_id
  )
  ON CONFLICT (product_code)
  DO UPDATE SET
    stock_quantity = products.stock_quantity + NEW.received_quantity,
    tpos_product_id = COALESCE(products.tpos_product_id, v_order_item.tpos_product_id),
    updated_at = now();

  RETURN NEW;
END;
$function$;