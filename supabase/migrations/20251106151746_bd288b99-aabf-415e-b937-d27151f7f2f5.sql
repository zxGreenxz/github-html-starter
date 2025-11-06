-- Fix N1648 and N1649 variants that were incorrectly parsed as 'FULLBOX'
-- Extract the actual size from the last parenthesis in product_name

-- Fix N1648 variants
UPDATE products 
SET 
  variant = SUBSTRING(product_name FROM '\(([^)]+)\)[^(]*$'),
  updated_at = NOW()
WHERE base_product_code = 'N1648' 
  AND product_code LIKE 'N1648A%'
  AND variant = 'FULLBOX';

-- Fix N1649 variants
UPDATE products 
SET 
  variant = SUBSTRING(product_name FROM '\(([^)]+)\)[^(]*$'),
  updated_at = NOW()
WHERE base_product_code = 'N1649'
  AND product_code LIKE 'N1649A%'
  AND variant = 'FULLBOX';

-- Log the fix
DO $$
DECLARE
  n1648_count INT;
  n1649_count INT;
BEGIN
  SELECT COUNT(*) INTO n1648_count FROM products WHERE base_product_code = 'N1648' AND product_code LIKE 'N1648A%';
  SELECT COUNT(*) INTO n1649_count FROM products WHERE base_product_code = 'N1649' AND product_code LIKE 'N1649A%';
  
  RAISE NOTICE '✅ Fixed % N1648 variants', n1648_count;
  RAISE NOTICE '✅ Fixed % N1649 variants', n1649_count;
END $$;