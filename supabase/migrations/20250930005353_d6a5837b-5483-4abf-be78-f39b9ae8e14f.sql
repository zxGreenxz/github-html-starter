-- Fix the security warning for the create_live_phases function
CREATE OR REPLACE FUNCTION public.create_live_phases(session_id uuid, start_date date)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Create 6 phases: 3 days x 2 phases (morning, evening)
  INSERT INTO public.live_phases (live_session_id, phase_date, phase_type)
  VALUES 
    (session_id, start_date, 'morning'),
    (session_id, start_date, 'evening'),
    (session_id, start_date + INTERVAL '1 day', 'morning'),
    (session_id, start_date + INTERVAL '1 day', 'evening'),
    (session_id, start_date + INTERVAL '2 days', 'morning'),
    (session_id, start_date + INTERVAL '2 days', 'evening');
END;
$function$