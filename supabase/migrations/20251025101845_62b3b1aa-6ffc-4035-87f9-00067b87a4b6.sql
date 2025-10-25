-- Drop tables in correct order (considering any dependencies)
DROP TABLE IF EXISTS public.scanned_barcodes_session CASCADE;
DROP TABLE IF EXISTS public.facebook_pending_orders CASCADE;
DROP TABLE IF EXISTS public.facebook_comments_archive CASCADE;
DROP TABLE IF EXISTS public.livestream_reports CASCADE;
DROP TABLE IF EXISTS public.facebook_pages CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS public.get_post_deletion_stats(text);
DROP FUNCTION IF EXISTS public.get_top_deleted_users(text, integer);
DROP FUNCTION IF EXISTS public.get_deletion_timeline(text, integer);
DROP FUNCTION IF EXISTS public.find_stale_comments(integer);
DROP FUNCTION IF EXISTS public.cleanup_old_deleted_comments(integer);
DROP FUNCTION IF EXISTS public.update_last_seen_at();
DROP FUNCTION IF EXISTS public.auto_fill_session_index_on_insert();
DROP FUNCTION IF EXISTS public.auto_fill_session_index_for_user();
DROP FUNCTION IF EXISTS public.update_facebook_comments_archive_updated_at();