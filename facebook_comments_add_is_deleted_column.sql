-- ===============================================
-- Migration: Add is_deleted column to existing table
-- ===============================================
-- Run this SQL in your Supabase SQL Editor if you already have
-- the facebook_comments_archive table and just need to add the new column

-- 1. Add is_deleted column (safe - won't affect existing data)
ALTER TABLE facebook_comments_archive 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add index for performance when filtering deleted comments
CREATE INDEX IF NOT EXISTS idx_fb_comments_not_deleted 
ON facebook_comments_archive(facebook_post_id, is_deleted) 
WHERE is_deleted = false;

-- 3. Optional: Update any existing comments that might be deleted
-- (This query checks if TPOS API currently returns 400 for any posts)
-- You can skip this if you want to start fresh from now

-- ===============================================
-- Migration complete!
-- ===============================================
-- The system will now:
-- 1. Track deleted comments with is_deleted = true
-- 2. Filter out deleted comments automatically
-- 3. Continue to show old comments even when post is deleted
-- ===============================================
