-- ===============================================
-- Setup Script for Facebook Comments Archive
-- ===============================================
-- Run this SQL in your Supabase SQL Editor
-- This will create the table, indexes, and RLS policies

-- 1. Drop table if exists (để tạo lại từ đầu)
DROP TABLE IF EXISTS facebook_comments_archive CASCADE;

-- 2. Create facebook_comments_archive table
CREATE TABLE facebook_comments_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Facebook data
  facebook_comment_id TEXT UNIQUE NOT NULL,
  facebook_post_id TEXT NOT NULL,
  facebook_user_id TEXT,
  facebook_user_name TEXT,
  comment_message TEXT,
  comment_created_time TIMESTAMPTZ,
  like_count INTEGER DEFAULT 0,
  
  -- TPOS tracking
  tpos_order_id TEXT,
  tpos_session_index TEXT,
  is_deleted_by_tpos BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE, -- Track if comment/post deleted by TPOS/Facebook
  tpos_sync_status TEXT DEFAULT 'no_order', -- 'no_order' | 'synced' | 'deleted'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX idx_fb_comments_post ON facebook_comments_archive(facebook_post_id);
CREATE INDEX idx_fb_comments_user ON facebook_comments_archive(facebook_user_id);
CREATE INDEX idx_fb_comments_tpos_order ON facebook_comments_archive(tpos_order_id);
CREATE INDEX idx_fb_comments_sync_status ON facebook_comments_archive(tpos_sync_status, is_deleted_by_tpos);
CREATE INDEX idx_fb_comments_post_time ON facebook_comments_archive(facebook_post_id, comment_created_time DESC);
CREATE INDEX idx_fb_comments_created_time ON facebook_comments_archive(comment_created_time);
CREATE INDEX idx_fb_comments_not_deleted ON facebook_comments_archive(facebook_post_id, is_deleted) WHERE is_deleted = false;

-- 4. Enable RLS
ALTER TABLE facebook_comments_archive ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read facebook_comments_archive" ON facebook_comments_archive;
DROP POLICY IF EXISTS "Allow service role all access" ON facebook_comments_archive;

-- 6. Create RLS Policies
-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read facebook_comments_archive"
ON facebook_comments_archive
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert/update (for Edge Functions)
CREATE POLICY "Allow service role all access"
ON facebook_comments_archive
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Enable realtime
ALTER TABLE facebook_comments_archive REPLICA IDENTITY FULL;

-- Drop from realtime first if exists (catch error if not in publication)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE facebook_comments_archive;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_comments_archive;

-- ===============================================
-- Setup complete!
-- ===============================================
-- The system will now:
-- 1. Save all comments to facebook_comments_archive
-- 2. Load comments from DB first (5-10x faster)
-- 3. Track orders deleted by TPOS
-- 4. Real-time updates enabled
-- ===============================================
-- NOTE: Cron job for cleanup already exists in your database
-- ===============================================
