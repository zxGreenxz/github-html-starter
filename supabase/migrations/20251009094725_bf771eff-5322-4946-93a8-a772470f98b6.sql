-- Add check constraint for customer_status values
ALTER TABLE public.customers 
DROP CONSTRAINT IF EXISTS customers_customer_status_check;

ALTER TABLE public.customers 
ADD CONSTRAINT customers_customer_status_check 
CHECK (customer_status IN ('normal', 'warning', 'danger', 'vip', 'wholesale', 'close', 'bomb'));

-- Add check constraint for info_status values
ALTER TABLE public.customers 
DROP CONSTRAINT IF EXISTS customers_info_status_check;

ALTER TABLE public.customers 
ADD CONSTRAINT customers_info_status_check 
CHECK (info_status IN ('complete', 'incomplete'));