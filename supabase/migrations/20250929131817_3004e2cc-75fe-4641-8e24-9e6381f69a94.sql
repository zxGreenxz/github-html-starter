-- Create live_sessions table
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live_products table
CREATE TABLE public.live_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  prepared_quantity INTEGER NOT NULL DEFAULT 0,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live_orders table
CREATE TABLE public.live_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  live_product_id UUID NOT NULL REFERENCES public.live_products(id) ON DELETE CASCADE,
  order_code TEXT NOT NULL,
  customer_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for all operations (since no auth is implemented)
CREATE POLICY "Allow all operations on live_sessions" 
ON public.live_sessions 
FOR ALL 
USING (true);

CREATE POLICY "Allow all operations on live_products" 
ON public.live_products 
FOR ALL 
USING (true);

CREATE POLICY "Allow all operations on live_orders" 
ON public.live_orders 
FOR ALL 
USING (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_products_updated_at
BEFORE UPDATE ON public.live_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_live_products_session_id ON public.live_products(live_session_id);
CREATE INDEX idx_live_orders_session_id ON public.live_orders(live_session_id);
CREATE INDEX idx_live_orders_product_id ON public.live_orders(live_product_id);
CREATE INDEX idx_live_sessions_date ON public.live_sessions(session_date);