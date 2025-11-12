-- Xóa tpos_image_url của các sản phẩm có mã bắt đầu bằng Q
UPDATE products
SET 
  tpos_image_url = NULL,
  updated_at = NOW()
WHERE product_code ILIKE 'Q%' 
  AND tpos_image_url IS NOT NULL;