-- Create table for Facebook pending orders (orders without products assigned)
CREATE TABLE public.facebook_pending_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  session_index text,
  code text,
  phone text,
  comment text,
  created_time timestamp with time zone NOT NULL DEFAULT now(),
  tpos_order_id text,
  facebook_comment_id text,
  facebook_user_id text,
  facebook_post_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facebook_pending_orders ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view all pending orders"
  ON public.facebook_pending_orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert pending orders"
  ON public.facebook_pending_orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pending orders"
  ON public.facebook_pending_orders FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete pending orders"
  ON public.facebook_pending_orders FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_facebook_pending_orders_updated_at
  BEFORE UPDATE ON public.facebook_pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();