-- Remove unused invoice_number and invoice_date columns from purchase_orders
ALTER TABLE purchase_orders 
DROP COLUMN IF EXISTS invoice_number,
DROP COLUMN IF EXISTS invoice_date;