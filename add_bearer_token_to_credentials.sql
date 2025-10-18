-- Add bearer_token column to tpos_credentials table
-- This allows storing the bearer token directly in the credentials table

ALTER TABLE public.tpos_credentials 
ADD COLUMN IF NOT EXISTS bearer_token TEXT;

COMMENT ON COLUMN public.tpos_credentials.bearer_token IS 'Bearer token fetched from TPOS API';

-- Remove is_active column as it's no longer needed
ALTER TABLE public.tpos_credentials 
DROP COLUMN IF EXISTS is_active;
