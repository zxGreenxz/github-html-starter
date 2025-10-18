-- Add column to track if customer information is complete
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS info_status text DEFAULT 'incomplete' CHECK (info_status IN ('complete', 'incomplete'));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_info_status ON public.customers(info_status);

COMMENT ON COLUMN public.customers.info_status IS 'Tracks whether customer information is complete or incomplete';
