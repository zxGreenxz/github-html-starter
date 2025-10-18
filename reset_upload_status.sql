-- Reset all upload status and uploaded_at to NULL for fresh updates
UPDATE public.live_orders 
SET 
  uploaded_at = NULL,
  upload_status = NULL
WHERE uploaded_at IS NOT NULL OR upload_status IS NOT NULL;
