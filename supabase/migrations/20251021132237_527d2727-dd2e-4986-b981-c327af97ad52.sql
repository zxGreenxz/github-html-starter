-- Add JSONB column to store TPOSAttributeLine[] structure for accurate TPOS uploads
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_metadata JSONB;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_variant_metadata 
ON products USING gin (variant_metadata);

-- Add comment
COMMENT ON COLUMN products.variant_metadata IS 
'Stores TPOSAttributeLine[] structure - exact format for TPOS upload. Example:
[
  {
    "Attribute": {"Id": 3, "Name": "Màu", "Code": "Mau"},
    "Values": [
      {"Id": 7, "Name": "Đen", "Code": "den"},
      {"Id": 6, "Name": "Trắng", "Code": "trang"}
    ]
  }
]';