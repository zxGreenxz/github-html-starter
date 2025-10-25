-- Create product_attributes table
CREATE TABLE public.product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product_attribute_values table
CREATE TABLE public.product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attribute_id, value)
);

-- Enable RLS for product_attributes
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_product_attributes"
ON public.product_attributes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_product_attributes"
ON public.product_attributes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_product_attributes"
ON public.product_attributes FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "authenticated_delete_product_attributes"
ON public.product_attributes FOR DELETE
TO authenticated
USING (true);

-- Enable RLS for product_attribute_values
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_product_attribute_values"
ON public.product_attribute_values FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_product_attribute_values"
ON public.product_attribute_values FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_product_attribute_values"
ON public.product_attribute_values FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "authenticated_delete_product_attribute_values"
ON public.product_attribute_values FOR DELETE
TO authenticated
USING (true);

-- Insert default attributes
INSERT INTO public.product_attributes (name, display_order) VALUES
  ('Màu', 1),
  ('Size Số', 2),
  ('Size Chữ', 3);

-- Insert default values for "Màu"
INSERT INTO public.product_attribute_values (attribute_id, value, display_order)
SELECT id, 'Đen', 1 FROM public.product_attributes WHERE name = 'Màu'
UNION ALL
SELECT id, 'Trắng', 2 FROM public.product_attributes WHERE name = 'Màu'
UNION ALL
SELECT id, 'Đỏ', 3 FROM public.product_attributes WHERE name = 'Màu'
UNION ALL
SELECT id, 'Xanh', 4 FROM public.product_attributes WHERE name = 'Màu';

-- Insert default values for "Size Số"
INSERT INTO public.product_attribute_values (attribute_id, value, display_order)
SELECT id, '38', 1 FROM public.product_attributes WHERE name = 'Size Số'
UNION ALL
SELECT id, '39', 2 FROM public.product_attributes WHERE name = 'Size Số'
UNION ALL
SELECT id, '40', 3 FROM public.product_attributes WHERE name = 'Size Số'
UNION ALL
SELECT id, '41', 4 FROM public.product_attributes WHERE name = 'Size Số'
UNION ALL
SELECT id, '42', 5 FROM public.product_attributes WHERE name = 'Size Số';

-- Insert default values for "Size Chữ"
INSERT INTO public.product_attribute_values (attribute_id, value, display_order)
SELECT id, 'S', 1 FROM public.product_attributes WHERE name = 'Size Chữ'
UNION ALL
SELECT id, 'M', 2 FROM public.product_attributes WHERE name = 'Size Chữ'
UNION ALL
SELECT id, 'L', 3 FROM public.product_attributes WHERE name = 'Size Chữ'
UNION ALL
SELECT id, 'XL', 4 FROM public.product_attributes WHERE name = 'Size Chữ'
UNION ALL
SELECT id, 'XXL', 5 FROM public.product_attributes WHERE name = 'Size Chữ';