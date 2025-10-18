-- Add order_count column to facebook_pending_orders table
ALTER TABLE facebook_pending_orders 
ADD COLUMN order_count integer NOT NULL DEFAULT 1;

-- Add index for faster queries when checking existing orders
CREATE INDEX idx_facebook_pending_orders_comment_id_count 
ON facebook_pending_orders(facebook_comment_id, order_count DESC);