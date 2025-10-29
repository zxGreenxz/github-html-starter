-- Increase reservation hold time from 15 minutes to 360 minutes (6 hours)
ALTER TABLE public.product_code_reservations 
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '360 minutes');