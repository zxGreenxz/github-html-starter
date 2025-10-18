-- Add base_product_code column to purchase_order_items table
ALTER TABLE public.purchase_order_items 
ADD COLUMN base_product_code text;

-- Add index for better query performance
CREATE INDEX idx_purchase_order_items_base_product_code 
ON public.purchase_order_items(base_product_code);

-- Add comment
COMMENT ON COLUMN public.purchase_order_items.base_product_code 
IS 'Mã sản phẩm gốc (không có biến thể) - được lấy từ form tạo đơn';