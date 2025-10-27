-- Add column to store selected attribute value IDs for variant generation
ALTER TABLE purchase_order_items 
ADD COLUMN selected_attribute_value_ids uuid[] NULL;

COMMENT ON COLUMN purchase_order_items.selected_attribute_value_ids IS 'Array of product_attribute_values.id used to generate variants. Null for non-variant products.';
