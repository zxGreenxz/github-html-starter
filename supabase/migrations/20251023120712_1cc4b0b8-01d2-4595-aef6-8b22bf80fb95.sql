-- Fix security: Set search_path for auto_fill_session_index_on_insert function
CREATE OR REPLACE FUNCTION public.auto_fill_session_index_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;