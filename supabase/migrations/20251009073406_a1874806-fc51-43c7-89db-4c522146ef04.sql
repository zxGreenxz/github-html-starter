-- Tạo ENUM type cho product_type
CREATE TYPE product_type_enum AS ENUM ('hang_dat', 'hang_le', 'hang_so_luong');

-- Thêm cột product_type vào live_products
ALTER TABLE live_products 
ADD COLUMN product_type product_type_enum NOT NULL DEFAULT 'hang_dat';

-- Index để tăng hiệu suất query
CREATE INDEX idx_live_products_type ON live_products(product_type);

-- Comment mô tả
COMMENT ON COLUMN live_products.product_type IS 
'Loại sản phẩm: hang_dat (hàng đặt - mặc định), hang_le (hàng lẻ), hang_so_luong (hàng số lượng - chưa dùng)';