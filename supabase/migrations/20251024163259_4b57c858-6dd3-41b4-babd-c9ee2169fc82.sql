-- Add variant_config column to purchase_order_items to store variant generation config
ALTER TABLE purchase_order_items 
ADD COLUMN variant_config JSONB;