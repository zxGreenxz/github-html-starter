-- Add request_headers column to store cached headers from TPOS API
ALTER TABLE public.tpos_credentials 
ADD COLUMN IF NOT EXISTS request_headers JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.tpos_credentials.request_headers IS 'Cached request headers for TPOS API calls (User-Agent, TPOSAppVersion, Priority, etc.)';

-- Seed initial headers from the inspect network example (for tpos token type)
UPDATE public.tpos_credentials
SET request_headers = jsonb_build_object(
  'TPOSAppVersion', '5.10.26.1',
  'User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  'Accept-Language', 'en-US,en;q=0.9',
  'Priority', 'u=3, i',
  'Referer', 'https://tomato.tpos.vn/',
  'cached_at', NOW()::text
)
WHERE token_type = 'tpos' AND request_headers IS NULL;