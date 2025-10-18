-- Add columns to track TPOS deletion status
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS tpos_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tpos_deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN purchase_order_items.tpos_deleted IS 'Indicates if this product was deleted from TPOS';
COMMENT ON COLUMN purchase_order_items.tpos_deleted_at IS 'Timestamp when the product was detected as deleted from TPOS';