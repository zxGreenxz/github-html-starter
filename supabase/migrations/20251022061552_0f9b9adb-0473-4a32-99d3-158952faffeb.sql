-- Fix scanned_barcodes_session table to enable proper data saving

-- 1. Add unique constraint to prevent duplicates
ALTER TABLE scanned_barcodes_session
DROP CONSTRAINT IF EXISTS scanned_barcodes_session_unique;

ALTER TABLE scanned_barcodes_session
ADD CONSTRAINT scanned_barcodes_session_unique
UNIQUE (session_id, product_code, user_id);

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_scanned_barcodes_session_lookup
ON scanned_barcodes_session(session_id, user_id, scanned_at DESC);

-- 3. Fix RLS policy to allow authenticated users to insert their own barcodes
DROP POLICY IF EXISTS "Authenticated users can insert scanned barcodes" 
ON scanned_barcodes_session;

CREATE POLICY "Authenticated users can insert their scanned barcodes"
ON scanned_barcodes_session
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);