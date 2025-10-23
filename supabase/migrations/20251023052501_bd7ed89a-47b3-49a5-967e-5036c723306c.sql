-- Create bucket for migrated TPOS images
INSERT INTO storage.buckets (id, name, public)
VALUES ('tpos-images', 'tpos-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: anyone can read
CREATE POLICY "Public read access for tpos images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tpos-images');

-- RLS policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload tpos images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tpos-images');