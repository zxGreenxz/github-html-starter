-- Fix RLS policies for facebook_comments_archive table
-- Problem: Edge Function can write (SERVICE_ROLE), but client can't read (ANON_KEY)

-- Enable RLS if not already enabled
ALTER TABLE facebook_comments_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to read comments" ON facebook_comments_archive;
DROP POLICY IF EXISTS "Allow service role to manage comments" ON facebook_comments_archive;

-- Policy 1: Allow authenticated users to SELECT (read) all comments
CREATE POLICY "Allow authenticated users to read comments"
ON facebook_comments_archive
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow service role (Edge Functions) to do everything
CREATE POLICY "Allow service role to manage comments"
ON facebook_comments_archive
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'facebook_comments_archive';
