-- Add column to store TPOS SuggestionsVariant response
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_tpos_response JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_variant_tpos_response 
ON products USING gin (variant_tpos_response);

-- Add comment explaining the column
COMMENT ON COLUMN products.variant_tpos_response IS 
'Stores response from TPOS SuggestionsVariant API - processed variants ready for UpdateV2 upload';