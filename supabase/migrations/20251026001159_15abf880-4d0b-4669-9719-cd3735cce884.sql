-- Thêm các cột TPOS vào bảng product_attribute_values
ALTER TABLE product_attribute_values
ADD COLUMN IF NOT EXISTS tpos_id INTEGER,
ADD COLUMN IF NOT EXISTS tpos_attribute_id INTEGER,
ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Tạo index để tăng tốc query
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_tpos_id 
ON product_attribute_values(tpos_id);

CREATE INDEX IF NOT EXISTS idx_product_attribute_values_tpos_attribute_id 
ON product_attribute_values(tpos_attribute_id);

-- Comment để giải thích
COMMENT ON COLUMN product_attribute_values.tpos_id IS 'TPOS ProductAttributeValue ID';
COMMENT ON COLUMN product_attribute_values.tpos_attribute_id IS 'TPOS ProductAttribute ID (1=Size Chữ, 3=Màu, 4=Size Số)';
COMMENT ON COLUMN product_attribute_values.sequence IS 'Thứ tự sắp xếp trong TPOS';