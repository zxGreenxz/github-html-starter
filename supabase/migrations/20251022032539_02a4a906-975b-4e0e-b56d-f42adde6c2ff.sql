-- =====================================================
-- Auto-fill session_index for all comments from same user in same post
-- =====================================================

-- 1. Create function to auto-fill session_index
CREATE OR REPLACE FUNCTION auto_fill_session_index_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when session_index changes from NULL to a value
  IF OLD.session_index IS NULL AND NEW.session_index IS NOT NULL THEN
    -- Update all other comments from same user in same post that have NULL session_index
    UPDATE facebook_comments_archive
    SET session_index = NEW.session_index
    WHERE facebook_post_id = NEW.facebook_post_id
      AND facebook_user_id = NEW.facebook_user_id
      AND session_index IS NULL
      AND id != NEW.id; -- Don't update the record being updated
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger on facebook_comments_archive
DROP TRIGGER IF EXISTS trigger_auto_fill_session_index ON facebook_comments_archive;
CREATE TRIGGER trigger_auto_fill_session_index
  AFTER UPDATE OF session_index ON facebook_comments_archive
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_session_index_for_user();

-- 3. Backfill existing data (fill NULL session_index based on existing data)
UPDATE facebook_comments_archive AS target
SET session_index = source.session_index
FROM (
  SELECT DISTINCT ON (facebook_post_id, facebook_user_id)
    facebook_post_id,
    facebook_user_id,
    session_index
  FROM facebook_comments_archive
  WHERE session_index IS NOT NULL
  ORDER BY facebook_post_id, facebook_user_id, created_at DESC
) AS source
WHERE target.facebook_post_id = source.facebook_post_id
  AND target.facebook_user_id = source.facebook_user_id
  AND target.session_index IS NULL;

-- =====================================================
-- Migration complete!
-- =====================================================
-- The system will now:
-- 1. Automatically fill session_index for all comments from same user
-- 2. Update in realtime when session_index is set
-- 3. Maintain consistency (1 user = 1 session_index per live session)
-- =====================================================