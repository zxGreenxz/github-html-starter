-- Enable realtime for facebook_comments_archive table
ALTER TABLE facebook_comments_archive REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_comments_archive;

-- Verify the table is in the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'facebook_comments_archive';
