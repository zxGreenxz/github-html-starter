-- Create table for purchase order validation settings
CREATE TABLE IF NOT EXISTS public.purchase_order_validation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_purchase_price INTEGER NOT NULL DEFAULT 0,
  max_purchase_price INTEGER NOT NULL DEFAULT 0,
  min_selling_price INTEGER NOT NULL DEFAULT 0,
  max_selling_price INTEGER NOT NULL DEFAULT 0,
  min_margin INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.purchase_order_validation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own settings
CREATE POLICY "Users can view their own validation settings"
  ON public.purchase_order_validation_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own validation settings"
  ON public.purchase_order_validation_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own validation settings"
  ON public.purchase_order_validation_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own validation settings"
  ON public.purchase_order_validation_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_purchase_order_validation_settings_updated_at
  BEFORE UPDATE ON public.purchase_order_validation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_purchase_order_validation_settings_user_id 
  ON public.purchase_order_validation_settings(user_id);