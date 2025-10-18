-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_table_name ON public.activity_logs(table_name);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "authenticated_select_activity_logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated'::text);

-- Create function to log activities
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Get username from profiles table
  SELECT username INTO v_username
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- If no username found, use 'Unknown'
  v_username := COALESCE(v_username, 'Unknown');

  -- Insert activity log
  INSERT INTO public.activity_logs (user_id, username, action, table_name, record_id, changes)
  VALUES (
    auth.uid(),
    v_username,
    LOWER(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for purchase_orders
CREATE TRIGGER log_purchase_orders_activity
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for purchase_order_items
CREATE TRIGGER log_purchase_order_items_activity
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for products
CREATE TRIGGER log_products_activity
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for live_orders
CREATE TRIGGER log_live_orders_activity
AFTER INSERT OR UPDATE OR DELETE ON public.live_orders
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for live_sessions
CREATE TRIGGER log_live_sessions_activity
AFTER INSERT OR UPDATE OR DELETE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for live_products
CREATE TRIGGER log_live_products_activity
AFTER INSERT OR UPDATE OR DELETE ON public.live_products
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for goods_receiving
CREATE TRIGGER log_goods_receiving_activity
AFTER INSERT OR UPDATE OR DELETE ON public.goods_receiving
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Create triggers for goods_receiving_items
CREATE TRIGGER log_goods_receiving_items_activity
AFTER INSERT OR UPDATE OR DELETE ON public.goods_receiving_items
FOR EACH ROW EXECUTE FUNCTION public.log_activity();