-- Add prediction tracking columns to facebook_pending_orders
ALTER TABLE facebook_pending_orders 
ADD COLUMN IF NOT EXISTS predicted_session_index INTEGER,
ADD COLUMN IF NOT EXISTS is_prediction_correct BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prediction_method TEXT DEFAULT 'tpos_response',
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_facebook_pending_orders_user_session 
ON facebook_pending_orders(facebook_user_id, session_index DESC NULLS LAST);

-- Create tracking table for corrections (for monitoring dashboard)
CREATE TABLE IF NOT EXISTS session_index_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id TEXT NOT NULL,
  facebook_user_id TEXT NOT NULL,
  predicted INTEGER NOT NULL,
  actual INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  corrected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- RLS policies for corrections table
ALTER TABLE session_index_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read corrections"
ON session_index_corrections FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Service role can manage corrections"
ON session_index_corrections FOR ALL
TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE session_index_corrections;

-- Add comment for clarity
COMMENT ON TABLE session_index_corrections IS 'Tracks session_index prediction corrections for monitoring and analytics';