-- =====================================================
-- Table: facebook_live_comments_snapshot
-- Purpose: Store complete comment array as JSON
-- =====================================================

CREATE TABLE IF NOT EXISTS facebook_live_comments_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Video identifier
  facebook_post_id TEXT NOT NULL UNIQUE,
  
  -- Complete comments array (JSON)
  comments_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  total_comments INTEGER DEFAULT 0,
  last_tpos_count INTEGER DEFAULT 0,
  deleted_count INTEGER DEFAULT 0,
  
  -- Timestamps
  first_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_live_comments_post ON facebook_live_comments_snapshot(facebook_post_id);
CREATE INDEX idx_live_comments_updated ON facebook_live_comments_snapshot(updated_at DESC);

-- RLS policies
ALTER TABLE facebook_live_comments_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read live comments"
ON facebook_live_comments_snapshot
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow service role all access live comments"
ON facebook_live_comments_snapshot
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER TABLE facebook_live_comments_snapshot REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_live_comments_snapshot;
