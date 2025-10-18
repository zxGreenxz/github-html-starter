-- Fix the security warning by properly configuring the function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  extracted_username TEXT;
BEGIN
  -- Extract username from email (part before @internal.app)
  extracted_username := split_part(NEW.email, '@', 1);
  
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, extracted_username, extracted_username);
  
  RETURN NEW;
END;
$$;