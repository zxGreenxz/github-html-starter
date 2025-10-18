-- Function to extract supplier name from product name
-- Pattern: ddmm A## or [CODE] ddmm A## format
-- Example: "0510 A43 SET ÁO TD" → A43
CREATE OR REPLACE FUNCTION public.extract_supplier_from_name(product_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Return null if input is null or empty
  IF product_name IS NULL OR trim(product_name) = '' THEN
    RETURN NULL;
  END IF;

  -- Pattern 1: ddmm A## format (most common)
  -- Example: "0510 A43 SET ÁO TD" → A43
  IF product_name ~ '^\d{4}\s+([A-Z]\d{1,4})\s+' THEN
    RETURN (regexp_match(product_name, '^\d{4}\s+([A-Z]\d{1,4})\s+'))[1];
  END IF;

  -- Pattern 2: [CODE] ddmm A## format
  -- Example: "[LQU53A4] 0510 A16 QUẦN SUÔNG" → A16
  IF product_name ~ '^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+' THEN
    RETURN (regexp_match(product_name, '^\[[\w\d]+\]\s*\d{4}\s+([A-Z]\d{1,4})\s+'))[1];
  END IF;

  -- Pattern 3: A## at the start (no date)
  -- Example: "A43 SET ÁO TD" → A43
  IF product_name ~ '^([A-Z]\d{1,4})\s+' THEN
    RETURN (regexp_match(product_name, '^([A-Z]\d{1,4})\s+'))[1];
  END IF;

  -- Pattern 4: A## anywhere in the first part
  -- Example: "SET A43 ÁO TD" → A43
  IF product_name ~ '\b([A-Z]\d{1,4})\b' THEN
    RETURN (regexp_match(product_name, '\b([A-Z]\d{1,4})\b'))[1];
  END IF;

  RETURN NULL;
END;
$$;

-- Function to update missing suppliers for all products
CREATE OR REPLACE FUNCTION public.update_missing_suppliers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  -- Update products where supplier_name is null or empty
  WITH updated AS (
    UPDATE public.products
    SET 
      supplier_name = extract_supplier_from_name(product_name),
      updated_at = now()
    WHERE 
      (supplier_name IS NULL OR supplier_name = '')
      AND extract_supplier_from_name(product_name) IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$;

-- Function to get supplier statistics
CREATE OR REPLACE FUNCTION public.get_supplier_stats()
RETURNS TABLE (
  supplier_name text,
  total_products bigint,
  total_stock_value numeric,
  out_of_stock_count bigint,
  total_quantity bigint
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
    COALESCE(SUM(p.stock_quantity * p.selling_price), 0)::numeric as total_stock_value,
    COUNT(*) FILTER (WHERE p.stock_quantity = 0)::bigint as out_of_stock_count,
    COALESCE(SUM(p.stock_quantity), 0)::bigint as total_quantity
  FROM public.products p
  WHERE p.supplier_name IS NOT NULL 
    AND p.supplier_name != ''
  GROUP BY p.supplier_name
  ORDER BY total_products DESC;
END;
$$;

-- Create index for better performance on supplier queries
CREATE INDEX IF NOT EXISTS idx_products_supplier_name ON public.products(supplier_name) 
WHERE supplier_name IS NOT NULL AND supplier_name != '';