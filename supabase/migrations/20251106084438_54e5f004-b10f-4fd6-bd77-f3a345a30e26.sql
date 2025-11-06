-- Add invoice_amount column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN invoice_amount numeric DEFAULT 0;