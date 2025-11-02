-- Clean up base64 strings incorrectly stored in tpos_image_url
-- This will set tpos_image_url to NULL for all entries that are base64 strings
UPDATE products
SET tpos_image_url = NULL
WHERE tpos_image_url NOT LIKE 'http%'
  AND tpos_image_url IS NOT NULL;