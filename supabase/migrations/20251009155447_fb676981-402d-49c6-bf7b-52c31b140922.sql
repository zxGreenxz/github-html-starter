-- Enable RLS on backup table
ALTER TABLE products_duplicate_cleanup ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view backup records
CREATE POLICY "authenticated_select_products_duplicate_cleanup"
ON products_duplicate_cleanup
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');