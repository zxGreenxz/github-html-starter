-- Add new columns to product_attribute_values table
ALTER TABLE product_attribute_values 
ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE product_attribute_values 
ADD COLUMN IF NOT EXISTS price_extra NUMERIC DEFAULT 0;

ALTER TABLE product_attribute_values 
ADD COLUMN IF NOT EXISTS name_get TEXT;

-- Create index for code column for faster searches
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_code 
ON product_attribute_values(code);

-- Add comments for documentation
COMMENT ON COLUMN product_attribute_values.code IS 'Mã thuộc tính từ TPOS (ví dụ: "29", "S", "Đen")';
COMMENT ON COLUMN product_attribute_values.price_extra IS 'Giá phụ thu cho biến thể này (ví dụ: size XL +20000đ)';
COMMENT ON COLUMN product_attribute_values.name_get IS 'Tên đầy đủ kết hợp: "AttributeName: Value" (ví dụ: "Size Số: 29")';