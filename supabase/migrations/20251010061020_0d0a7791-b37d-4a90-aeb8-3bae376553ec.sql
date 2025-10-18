-- Update image_url for live_products records that have null image_url
-- Get the tpos_image_url from products table
UPDATE live_products lp
SET image_url = p.tpos_image_url
FROM products p
WHERE lp.product_code = p.product_code
  AND lp.image_url IS NULL
  AND p.tpos_image_url IS NOT NULL;