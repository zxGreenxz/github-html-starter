-- Create live_phases table to manage individual phases within live sessions
CREATE TABLE public.live_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id UUID NOT NULL,
  phase_date DATE NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('morning', 'evening')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, phase_date, phase_type)
);

-- Enable RLS on live_phases
ALTER TABLE public.live_phases ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for live_phases
CREATE POLICY "Allow all operations on live_phases" 
ON public.live_phases 
FOR ALL 
USING (true);

-- Add live_phase_id to live_products table
ALTER TABLE public.live_products 
ADD COLUMN live_phase_id UUID;

-- Add live_phase_id to live_orders table  
ALTER TABLE public.live_orders
ADD COLUMN live_phase_id UUID;

-- Update live_sessions table to support multi-day sessions
ALTER TABLE public.live_sessions
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN session_name TEXT;

-- Create trigger for live_phases updated_at
CREATE TRIGGER update_live_phases_updated_at
BEFORE UPDATE ON public.live_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create phases for a live session
CREATE OR REPLACE FUNCTION public.create_live_phases(
  session_id UUID,
  start_date DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
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
$$;