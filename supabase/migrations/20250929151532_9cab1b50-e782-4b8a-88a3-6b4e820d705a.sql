-- Create livestream_reports table
CREATE TABLE public.livestream_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  morning_ad_cost NUMERIC DEFAULT 0,
  evening_ad_cost NUMERIC DEFAULT 0,
  morning_duration TEXT,
  evening_duration TEXT,
  morning_live_orders INTEGER DEFAULT 0,
  evening_live_orders INTEGER DEFAULT 0,
  total_inbox_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.livestream_reports ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on livestream_reports" 
ON public.livestream_reports 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_livestream_reports_updated_at
BEFORE UPDATE ON public.livestream_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();