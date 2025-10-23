-- Enable auto-fill session_index on INSERT for facebook_comments_archive
-- When a new comment is inserted with session_index = NULL,
-- automatically fill it with the session_index from previous comments
-- by the same user in the same video

-- 1. Create function for INSERT trigger
CREATE OR REPLACE FUNCTION public.auto_fill_session_index_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  existing_session_index TEXT;
BEGIN
  -- Only run if session_index is NULL on insert
  IF NEW.session_index IS NULL THEN
    -- Find existing session_index from same user in same post
    SELECT session_index INTO existing_session_index
    FROM public.facebook_comments_archive
    WHERE facebook_post_id = NEW.facebook_post_id
      AND facebook_user_id = NEW.facebook_user_id
      AND session_index IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If found, set it on the new record
    IF existing_session_index IS NOT NULL THEN
      NEW.session_index := existing_session_index;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trigger_auto_fill_session_index_on_insert ON public.facebook_comments_archive;

CREATE TRIGGER trigger_auto_fill_session_index_on_insert
  BEFORE INSERT ON public.facebook_comments_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_session_index_on_insert();