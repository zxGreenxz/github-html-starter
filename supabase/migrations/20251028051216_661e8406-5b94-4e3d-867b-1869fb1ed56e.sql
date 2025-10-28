-- Add TPOS sync tracking columns to purchase_order_items
ALTER TABLE purchase_order_items 
ADD COLUMN tpos_sync_status TEXT DEFAULT 'pending' 
  CHECK (tpos_sync_status IN ('pending', 'processing', 'success', 'failed')),
ADD COLUMN tpos_sync_error TEXT,
ADD COLUMN tpos_sync_started_at TIMESTAMPTZ,
ADD COLUMN tpos_sync_completed_at TIMESTAMPTZ;

-- Index for better query performance
CREATE INDEX idx_purchase_order_items_sync_status 
ON purchase_order_items(tpos_sync_status);

-- Add comments for documentation
COMMENT ON COLUMN purchase_order_items.tpos_sync_status IS 
  'TPOS sync status: pending (chưa xử lý), processing (đang xử lý), success (thành công), failed (lỗi)';
COMMENT ON COLUMN purchase_order_items.tpos_sync_error IS 
  'Chi tiết lỗi nếu sync failed';
COMMENT ON COLUMN purchase_order_items.tpos_sync_started_at IS 
  'Thời gian bắt đầu xử lý TPOS sync';
COMMENT ON COLUMN purchase_order_items.tpos_sync_completed_at IS 
  'Thời gian hoàn thành TPOS sync (success hoặc failed)';