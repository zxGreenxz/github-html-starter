-- Thay đổi column order_date từ date sang timestamp with time zone
-- để lưu được cả giờ phút thực tế khi tạo đơn hàng

ALTER TABLE purchase_orders 
ALTER COLUMN order_date TYPE timestamp with time zone 
USING order_date::timestamp with time zone;

-- Cập nhật default value từ CURRENT_DATE sang now()
ALTER TABLE purchase_orders 
ALTER COLUMN order_date SET DEFAULT now();