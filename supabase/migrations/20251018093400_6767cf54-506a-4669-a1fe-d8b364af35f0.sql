-- Rename column order_code to session_index in live_orders table
ALTER TABLE live_orders 
RENAME COLUMN order_code TO session_index;

-- Change data type from TEXT to INTEGER
ALTER TABLE live_orders 
ALTER COLUMN session_index TYPE INTEGER 
USING session_index::integer;

-- Add comment for documentation
COMMENT ON COLUMN live_orders.session_index IS 'Sequential order number from TPOS (SessionIndex), e.g., 1, 2, 3, 66, 105...';