-- Test if we can insert/update comment_type in facebook_pending_orders
-- Run this in Supabase SQL Editor

-- 1. Check RLS policies on the table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'facebook_pending_orders';

-- 2. Check if table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'facebook_pending_orders';

-- 3. Try a test insert with comment_type
INSERT INTO facebook_pending_orders (
  name,
  comment,
  facebook_comment_id,
  facebook_user_id,
  facebook_post_id,
  order_count,
  comment_type,
  created_time
) VALUES (
  'TEST USER',
  'TEST COMMENT',
  'test_comment_id_' || NOW()::text,
  'test_user_id',
  'test_post_id',
  1,
  'hang_dat',
  NOW()
) RETURNING id, comment_type;

-- 4. Clean up test data
DELETE FROM facebook_pending_orders 
WHERE name = 'TEST USER' AND comment = 'TEST COMMENT';
