-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  customer_status TEXT NOT NULL DEFAULT 'normal',
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  facebook_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phone)
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customers
CREATE POLICY "authenticated_select_customers" 
ON public.customers 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_customers" 
ON public.customers 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_customers" 
ON public.customers 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on phone for fast lookup
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_facebook_id ON public.customers(facebook_id);
CREATE INDEX idx_customers_status ON public.customers(customer_status);