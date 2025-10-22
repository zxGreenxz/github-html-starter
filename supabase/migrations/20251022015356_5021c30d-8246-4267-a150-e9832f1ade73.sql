-- Create table for scanned barcodes with session tracking
CREATE TABLE scanned_barcodes_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session context
  session_id TEXT NOT NULL,              -- videoId/postId from Facebook
  page_id TEXT NOT NULL,                 -- Facebook page ID
  
  -- User info
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  
  -- Product info
  product_code TEXT NOT NULL,
  product_name TEXT,
  variant TEXT,
  image_url TEXT,
  base_product_code TEXT,
  
  -- Timestamps
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates in same session
  UNIQUE(session_id, product_code)
);

-- Create indexes for performance
CREATE INDEX idx_scanned_barcodes_session_id ON scanned_barcodes_session(session_id);
CREATE INDEX idx_scanned_barcodes_page_id ON scanned_barcodes_session(page_id);
CREATE INDEX idx_scanned_barcodes_created_at ON scanned_barcodes_session(created_at DESC);

-- Enable RLS
ALTER TABLE scanned_barcodes_session ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read scanned barcodes"
  ON scanned_barcodes_session
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scanned barcodes"
  ON scanned_barcodes_session
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scanned barcodes"
  ON scanned_barcodes_session
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete any scanned barcode in their session"
  ON scanned_barcodes_session
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER TABLE scanned_barcodes_session REPLICA IDENTITY FULL;