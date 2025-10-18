-- Drop and recreate get_supplier_stats with all required fields
DROP FUNCTION IF EXISTS public.get_supplier_stats();

CREATE FUNCTION public.get_supplier_stats()
RETURNS TABLE (
  supplier_name text,
  total_products bigint,
  total_inventory_value numeric,
  out_of_stock_count bigint,
  low_stock_count bigint,
  avg_stock numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.supplier_name,
    COUNT(*)::bigint as total_products,
    COALESCE(SUM(p.stock_quantity * p.selling_price), 0)::numeric as total_inventory_value,
    COUNT(*) FILTER (WHERE p.stock_quantity = 0)::bigint as out_of_stock_count,
    COUNT(*) FILTER (WHERE p.stock_quantity > 0 AND p.stock_quantity <= 5)::bigint as low_stock_count,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(p.stock_quantity)::numeric / COUNT(*)::numeric, 0)
      ELSE 0
    END as avg_stock
  FROM public.products p
  WHERE p.supplier_name IS NOT NULL 
    AND p.supplier_name != ''
  GROUP BY p.supplier_name
  ORDER BY total_products DESC;
END;
$$;