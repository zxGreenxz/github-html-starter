-- Add facebook_comment_id to live_orders to track which specific comment was used
ALTER TABLE live_orders
ADD COLUMN IF NOT EXISTS facebook_comment_id text;