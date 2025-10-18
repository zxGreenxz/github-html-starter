-- Check existing RLS policies for facebook_comments_archive
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'facebook_comments_archive';

-- Enable RLS if not already enabled
ALTER TABLE facebook_comments_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to recreate them)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON facebook_comments_archive;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON facebook_comments_archive;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON facebook_comments_archive;

-- Create policy to allow authenticated users to read all comments
CREATE POLICY "Enable read access for authenticated users" ON facebook_comments_archive
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to insert comments
CREATE POLICY "Enable insert access for authenticated users" ON facebook_comments_archive
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to update comments
CREATE POLICY "Enable update access for authenticated users" ON facebook_comments_archive
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'facebook_comments_archive';
