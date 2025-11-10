-- Function to get max product code number for a category
-- Faster than client-side parsing for large datasets
CREATE OR REPLACE FUNCTION public.get_max_product_code_number(
  category_prefix text,
  table_name text DEFAULT 'products'
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_number integer := 0;
  product_code_val text;
  extracted_number text;
BEGIN
  -- Validate table name to prevent SQL injection
  IF table_name NOT IN ('products', 'purchase_order_items') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  -- Query all product codes matching the prefix
  FOR product_code_val IN
    EXECUTE format(
      'SELECT product_code FROM %I WHERE product_code LIKE $1 || ''%%''',
      table_name
    )
    USING category_prefix
  LOOP
    -- Extract trailing digits using regex
    extracted_number := substring(product_code_val FROM '\d+$');
    
    -- If we found digits, convert to integer and update max
    IF extracted_number IS NOT NULL THEN
      max_number := GREATEST(max_number, extracted_number::integer);
    END IF;
  END LOOP;
  
  RETURN max_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_max_product_code_number(text, text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_max_product_code_number IS 
'Returns the highest numeric suffix from product codes matching a category prefix. 
Example: get_max_product_code_number(''N'', ''products'') → 1234 if max code is N1234';