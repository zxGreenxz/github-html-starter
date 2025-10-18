-- Create table to store TPOS credentials for auto token refresh
CREATE TABLE IF NOT EXISTS public.tpos_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tpos_credentials ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can manage credentials
CREATE POLICY "Authenticated users can view credentials"
  ON public.tpos_credentials
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert credentials"
  ON public.tpos_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update credentials"
  ON public.tpos_credentials
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete credentials"
  ON public.tpos_credentials
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON TABLE public.tpos_credentials IS 'Stores TPOS login credentials for automatic token refresh';
COMMENT ON COLUMN public.tpos_credentials.name IS 'Display name for the credential';
COMMENT ON COLUMN public.tpos_credentials.username IS 'TPOS username';
COMMENT ON COLUMN public.tpos_credentials.password IS 'TPOS password (encrypted)';
COMMENT ON COLUMN public.tpos_credentials.is_active IS 'Whether this credential should be used for auto-refresh';
