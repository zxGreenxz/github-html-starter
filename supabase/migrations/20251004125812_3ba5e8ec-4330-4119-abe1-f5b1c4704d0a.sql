-- Create function to calculate product statistics
CREATE OR REPLACE FUNCTION public.get_product_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_products', COUNT(*),
    'total_inventory_value', COALESCE(SUM(stock_quantity * selling_price), 0),
    'out_of_stock_count', COUNT(*) FILTER (WHERE stock_quantity = 0),
    'negative_stock_count', COUNT(*) FILTER (WHERE stock_quantity < 0)
  )
  INTO result
  FROM public.products;
  
  RETURN result;
END;
$$;