-- Add customer_status column to live_orders table
ALTER TABLE live_orders 
ADD COLUMN customer_status TEXT DEFAULT 'normal' CHECK (customer_status IN ('normal', 'bom_hang', 'thieu_thong_tin'));

-- Create index for better query performance
CREATE INDEX idx_live_orders_customer_status ON live_orders(customer_status);

-- Add comment for documentation
COMMENT ON COLUMN live_orders.customer_status IS 'Customer order status: normal (default), bom_hang (cancelled by customer - red), thieu_thong_tin (missing info - gray)';