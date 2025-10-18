-- Add is_oversell column to live_orders table
ALTER TABLE live_orders
ADD COLUMN is_oversell boolean DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN live_orders.is_oversell IS 'Marks orders that exceed prepared quantity (oversold orders)';