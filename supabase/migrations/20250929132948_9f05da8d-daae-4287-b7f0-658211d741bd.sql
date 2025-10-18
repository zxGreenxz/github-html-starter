-- Remove customer_code column from live_orders table since order_code serves as customer identifier
ALTER TABLE public.live_orders DROP COLUMN customer_code;