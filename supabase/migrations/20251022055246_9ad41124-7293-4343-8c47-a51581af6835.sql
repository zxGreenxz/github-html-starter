-- Add virtual_available column for TPOS VirtualAvailable field
ALTER TABLE products
ADD COLUMN IF NOT EXISTS virtual_available integer DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN products.virtual_available IS 'Số lượng dự báo từ TPOS (VirtualAvailable) - tính cả đơn hàng chưa nhận';