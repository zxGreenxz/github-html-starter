-- Create table for network printers
CREATE TABLE public.printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 9100,
  bridge_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for printer templates
CREATE TABLE public.printer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width TEXT NOT NULL,
  custom_width TEXT NOT NULL,
  height TEXT NOT NULL,
  custom_height TEXT NOT NULL,
  threshold TEXT NOT NULL,
  scale TEXT NOT NULL,
  font_session TEXT NOT NULL,
  font_phone TEXT NOT NULL,
  font_customer TEXT NOT NULL,
  font_product TEXT NOT NULL,
  padding TEXT NOT NULL,
  line_spacing TEXT NOT NULL,
  alignment TEXT NOT NULL CHECK (alignment IN ('left', 'center', 'right')),
  is_bold BOOLEAN NOT NULL DEFAULT false,
  is_italic BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for current format settings
CREATE TABLE public.printer_format_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  width TEXT NOT NULL,
  custom_width TEXT NOT NULL,
  height TEXT NOT NULL,
  custom_height TEXT NOT NULL,
  threshold TEXT NOT NULL,
  scale TEXT NOT NULL,
  font_session TEXT NOT NULL,
  font_phone TEXT NOT NULL,
  font_customer TEXT NOT NULL,
  font_product TEXT NOT NULL,
  padding TEXT NOT NULL,
  line_spacing TEXT NOT NULL,
  alignment TEXT NOT NULL CHECK (alignment IN ('left', 'center', 'right')),
  is_bold BOOLEAN NOT NULL DEFAULT false,
  is_italic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_format_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for printer_configs
CREATE POLICY "Users can view their own printer configs"
  ON public.printer_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own printer configs"
  ON public.printer_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printer configs"
  ON public.printer_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printer configs"
  ON public.printer_configs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for printer_templates
CREATE POLICY "Users can view their own printer templates"
  ON public.printer_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own printer templates"
  ON public.printer_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printer templates"
  ON public.printer_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printer templates"
  ON public.printer_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for printer_format_settings
CREATE POLICY "Users can view their own format settings"
  ON public.printer_format_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own format settings"
  ON public.printer_format_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own format settings"
  ON public.printer_format_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own format settings"
  ON public.printer_format_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_printer_configs_user_id ON public.printer_configs(user_id);
CREATE INDEX idx_printer_templates_user_id ON public.printer_templates(user_id);
CREATE INDEX idx_printer_format_settings_user_id ON public.printer_format_settings(user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_printer_configs_updated_at
  BEFORE UPDATE ON public.printer_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printer_templates_updated_at
  BEFORE UPDATE ON public.printer_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printer_format_settings_updated_at
  BEFORE UPDATE ON public.printer_format_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();