-- Add token_type column to tpos_credentials table
-- This allows users to specify which token (TPOS or FACEBOOK) should be updated when refreshing

ALTER TABLE public.tpos_credentials 
ADD COLUMN IF NOT EXISTS token_type TEXT NOT NULL DEFAULT 'tpos';

-- Add constraint to ensure valid token types
ALTER TABLE public.tpos_credentials 
ADD CONSTRAINT valid_token_type 
CHECK (token_type IN ('tpos', 'facebook'));

-- Add comment
COMMENT ON COLUMN public.tpos_credentials.token_type IS 'Type of token to update: tpos or facebook';

-- Update existing records to have token_type
UPDATE public.tpos_credentials 
SET token_type = 'tpos' 
WHERE token_type IS NULL;
