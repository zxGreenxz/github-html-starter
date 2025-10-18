-- Enable RLS on products_cleanup_backup table
ALTER TABLE products_cleanup_backup ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for viewing backup records (authenticated users only)
CREATE POLICY "authenticated_select_products_cleanup_backup"
ON products_cleanup_backup
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- Create RLS policy for inserting backup records (system only, via SECURITY DEFINER functions)
CREATE POLICY "authenticated_insert_products_cleanup_backup"
ON products_cleanup_backup
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');