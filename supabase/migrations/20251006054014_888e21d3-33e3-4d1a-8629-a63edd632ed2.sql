-- Add upload tracking columns to live_orders table
ALTER TABLE public.live_orders 
ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN upload_status TEXT CHECK (upload_status IN ('pending', 'success', 'failed'));