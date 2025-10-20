-- Add session_index column to facebook_comments_archive
ALTER TABLE public.facebook_comments_archive 
ADD COLUMN IF NOT EXISTS session_index integer;

-- Add comment explaining the column
COMMENT ON COLUMN public.facebook_comments_archive.session_index 
IS 'Số thứ tự đơn hàng trong phiên live từ TPOS API (76, 79, 82...)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_facebook_comments_archive_session_index 
ON public.facebook_comments_archive(session_index);