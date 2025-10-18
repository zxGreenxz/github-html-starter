-- Add new column for TPOS Order UUID/Id
ALTER TABLE live_orders 
ADD COLUMN IF NOT EXISTS code_tpos_oder_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_orders_code_tpos_oder_id ON live_orders(code_tpos_oder_id);

-- Add comment
COMMENT ON COLUMN live_orders.code_tpos_oder_id IS 'TPOS Order UUID/Id from TPOS API (e.g., 67700000-5d43-0015-8041-08de03ea5e08)';
COMMENT ON COLUMN live_orders.tpos_order_id IS 'TPOS Order Code from TPOS API (e.g., 251000152)';