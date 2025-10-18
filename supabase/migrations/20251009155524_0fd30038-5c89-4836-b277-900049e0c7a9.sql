-- Enable RLS on customers backup table
ALTER TABLE customers_backup_20251009 ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view backup records
CREATE POLICY "authenticated_select_customers_backup_20251009"
ON customers_backup_20251009
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');