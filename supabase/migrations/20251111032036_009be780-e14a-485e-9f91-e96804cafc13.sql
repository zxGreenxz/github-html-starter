-- Add columns to store boolean flags for validation rules
ALTER TABLE public.purchase_order_validation_settings
ADD COLUMN IF NOT EXISTS enable_require_product_name BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_product_code BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_product_images BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_positive_purchase_price BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_positive_selling_price BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_selling_greater_than_purchase BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_require_at_least_one_item BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comments for documentation
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_product_name IS 'Bật validation: Tên sản phẩm không được rỗng';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_product_code IS 'Bật validation: Mã sản phẩm không được rỗng';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_product_images IS 'Bật validation: Phải có ít nhất 1 hình ảnh';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_positive_purchase_price IS 'Bật validation: Giá mua phải > 0';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_positive_selling_price IS 'Bật validation: Giá bán phải > 0';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_selling_greater_than_purchase IS 'Bật validation: Giá bán phải > Giá mua';
COMMENT ON COLUMN purchase_order_validation_settings.enable_require_at_least_one_item IS 'Bật validation: Phải có ít nhất 1 sản phẩm';