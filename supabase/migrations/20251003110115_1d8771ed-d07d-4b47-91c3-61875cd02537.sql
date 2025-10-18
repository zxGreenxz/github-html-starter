-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code text NOT NULL UNIQUE,
  product_name text NOT NULL,
  variant text,
  selling_price numeric DEFAULT 0,
  purchase_price numeric DEFAULT 0,
  unit text DEFAULT 'Cái',
  category text,
  barcode text,
  stock_quantity integer DEFAULT 0,
  supplier_name text,
  product_images text[],
  price_images text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_products_code ON public.products(product_code);
CREATE INDEX idx_products_name ON public.products(product_name);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_barcode ON public.products(barcode);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Allow all operations
CREATE POLICY "Allow all operations on products" 
ON public.products 
FOR ALL 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update product stock when goods are received
CREATE OR REPLACE FUNCTION public.update_product_stock_on_receiving()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    price_images
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
    v_order_item.price_images
  )
  ON CONFLICT (product_code)
  DO UPDATE SET
    stock_quantity = products.stock_quantity + NEW.received_quantity,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger on goods_receiving_items
CREATE TRIGGER trigger_update_product_stock
AFTER INSERT ON public.goods_receiving_items
FOR EACH ROW
EXECUTE FUNCTION public.update_product_stock_on_receiving();