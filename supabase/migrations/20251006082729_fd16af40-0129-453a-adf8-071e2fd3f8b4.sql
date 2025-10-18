-- Fix security warning: Add search_path to extract_supplier_from_name function
CREATE OR REPLACE FUNCTION public.extract_supplier_from_name(product_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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