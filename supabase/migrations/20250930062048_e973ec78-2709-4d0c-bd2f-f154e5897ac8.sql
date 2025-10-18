-- Create goods_receiving table
CREATE TABLE public.goods_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  receiving_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  received_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  received_by_username TEXT NOT NULL,
  total_items_expected INTEGER NOT NULL DEFAULT 0,
  total_items_received INTEGER NOT NULL DEFAULT 0,
  has_discrepancy BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create goods_receiving_items table
CREATE TABLE public.goods_receiving_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receiving_id UUID NOT NULL REFERENCES public.goods_receiving(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  product_code TEXT,
  variant TEXT,
  expected_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  discrepancy_type TEXT,
  discrepancy_quantity INTEGER DEFAULT 0,
  product_condition TEXT DEFAULT 'good',
  item_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_goods_receiving_purchase_order ON public.goods_receiving(purchase_order_id);
CREATE INDEX idx_goods_receiving_date ON public.goods_receiving(receiving_date);
CREATE INDEX idx_goods_receiving_items_receiving ON public.goods_receiving_items(goods_receiving_id);

-- Create trigger for updated_at
CREATE TRIGGER update_goods_receiving_updated_at
  BEFORE UPDATE ON public.goods_receiving
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.goods_receiving ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receiving_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations on goods_receiving"
  ON public.goods_receiving FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on goods_receiving_items"
  ON public.goods_receiving_items FOR ALL
  USING (true);