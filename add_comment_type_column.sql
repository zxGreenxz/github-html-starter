-- Add comment_type column to facebook_pending_order table
-- Run this SQL in Supabase SQL Editor

ALTER TABLE public.facebook_pending_order 
ADD COLUMN IF NOT EXISTS comment_type TEXT;

-- Add helpful comment
COMMENT ON COLUMN public.facebook_pending_order.comment_type IS 'Type of comment associated with the pending order';

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'facebook_pending_order' 
AND column_name = 'comment_type';
