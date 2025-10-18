-- Add tpos_product_id column to purchase_order_items table
ALTER TABLE purchase_order_items 
ADD COLUMN tpos_product_id INTEGER NULL;

-- Add index for better query performance
CREATE INDEX idx_purchase_order_items_tpos_product_id 
ON purchase_order_items(tpos_product_id);

-- Add comment explaining the column
COMMENT ON COLUMN purchase_order_items.tpos_product_id 
IS 'ID của sản phẩm trên hệ thống TPOS sau khi upload thành công';