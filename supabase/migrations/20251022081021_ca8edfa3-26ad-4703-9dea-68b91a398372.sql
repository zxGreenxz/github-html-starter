-- Add facebook_post_id column to live_sessions table
ALTER TABLE live_sessions 
ADD COLUMN IF NOT EXISTS facebook_post_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN live_sessions.facebook_post_id IS 'Facebook video/post ID (objectId) for mapping with facebook_pending_orders. Auto-detected from currently live video.';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_facebook_post_id 
ON live_sessions(facebook_post_id);

-- Add index for finding sessions without facebook_post_id
CREATE INDEX IF NOT EXISTS idx_live_sessions_no_post_id 
ON live_sessions(facebook_post_id) 
WHERE facebook_post_id IS NULL;