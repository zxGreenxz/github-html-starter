-- Create product_code_reservations table for pessimistic locking
CREATE TABLE IF NOT EXISTS public.product_code_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE,
  reserved_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_product_code_reservations_expires_at ON public.product_code_reservations(expires_at);
CREATE INDEX idx_product_code_reservations_reserved_by ON public.product_code_reservations(reserved_by);

-- Enable RLS
ALTER TABLE public.product_code_reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reservations"
  ON public.product_code_reservations
  FOR SELECT
  USING (auth.uid() = reserved_by);

CREATE POLICY "Users can insert their own reservations"
  ON public.product_code_reservations
  FOR INSERT
  WITH CHECK (auth.uid() = reserved_by);

CREATE POLICY "Users can delete their own reservations"
  ON public.product_code_reservations
  FOR DELETE
  USING (auth.uid() = reserved_by);

-- Function to auto-cleanup expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.product_code_reservations
  WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run cleanup before each insert
CREATE TRIGGER trigger_cleanup_expired_reservations
  BEFORE INSERT ON public.product_code_reservations
  EXECUTE FUNCTION cleanup_expired_reservations();