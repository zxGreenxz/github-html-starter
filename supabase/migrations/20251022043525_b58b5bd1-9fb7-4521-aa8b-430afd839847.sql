-- =====================================================
-- Recreate trigger for auto-filling session_index
-- =====================================================

-- Drop trigger if exists (cleanup)
DROP TRIGGER IF EXISTS trigger_auto_fill_session_index ON facebook_comments_archive;

-- Recreate trigger
CREATE TRIGGER trigger_auto_fill_session_index
  AFTER UPDATE OF session_index ON facebook_comments_archive
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_session_index_for_user();

-- Verify trigger was created
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_name = 'trigger_auto_fill_session_index'
      AND event_object_table = 'facebook_comments_archive'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger "trigger_auto_fill_session_index" created successfully';
  ELSE
    RAISE EXCEPTION '❌ Trigger creation failed';
  END IF;
END $$;

-- Backfill any remaining NULL session_index (one-time cleanup)
WITH user_session_index AS (
  SELECT DISTINCT ON (facebook_post_id, facebook_user_id)
    facebook_post_id,
    facebook_user_id,
    session_index
  FROM facebook_comments_archive
  WHERE session_index IS NOT NULL
  ORDER BY facebook_post_id, facebook_user_id, created_at DESC
)
UPDATE facebook_comments_archive AS target
SET session_index = source.session_index
FROM user_session_index AS source
WHERE target.facebook_post_id = source.facebook_post_id
  AND target.facebook_user_id = source.facebook_user_id
  AND target.session_index IS NULL;

-- Log backfill results
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO backfilled_count
  FROM facebook_comments_archive
  WHERE session_index IS NULL;
  
  RAISE NOTICE '✅ Backfill complete. Remaining NULL session_index: %', backfilled_count;
END $$;