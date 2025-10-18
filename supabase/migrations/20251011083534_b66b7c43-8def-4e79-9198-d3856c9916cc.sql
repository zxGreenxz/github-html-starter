-- Create facebook_pages table to store page configurations
CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  page_id TEXT NOT NULL,
  crm_team_id TEXT,
  crm_team_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_id)
);

-- Enable RLS
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "authenticated_select_facebook_pages" 
  ON public.facebook_pages FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_insert_facebook_pages" 
  ON public.facebook_pages FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "authenticated_update_facebook_pages" 
  ON public.facebook_pages FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_delete_facebook_pages" 
  ON public.facebook_pages FOR DELETE 
  TO authenticated 
  USING (true);

-- Insert default pages
INSERT INTO public.facebook_pages (page_name, page_id) VALUES
  ('NHI JUDY Style', '193642490509664'),
  ('NhiJudy Nè', '193642490509664'),
  ('Nhi Judy House', '193642490509664'),
  ('NhiJudy Store', '193642490509664')
ON CONFLICT (page_id) DO NOTHING;