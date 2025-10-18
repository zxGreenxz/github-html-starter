-- Create table for TPOS configuration
CREATE TABLE public.tpos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bearer_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Only allow 1 active token at a time
CREATE UNIQUE INDEX idx_tpos_config_active ON public.tpos_config(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.tpos_config ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can select
CREATE POLICY "authenticated_select_tpos_config"
  ON public.tpos_config FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert
CREATE POLICY "authenticated_insert_tpos_config"
  ON public.tpos_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update
CREATE POLICY "authenticated_update_tpos_config"
  ON public.tpos_config FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_tpos_config_updated_at
  BEFORE UPDATE ON public.tpos_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();