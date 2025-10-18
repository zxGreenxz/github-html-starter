-- Add tpos_order_id column to live_orders table
ALTER TABLE live_orders 
ADD COLUMN tpos_order_id TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN live_orders.tpos_order_id IS 'TPOS order identifier for integration';