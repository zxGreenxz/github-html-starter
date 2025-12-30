# TECHNICAL IMPLEMENTATION GUIDE
## Tính năng Quản lý Đơn Đặt Hàng (Purchase Orders)

**Source URL:** https://n2store.vercel.app/purchase-orders  
**Ngày phân tích:** 30/12/2024  
**Phiên bản:** 1.0

---

## 1. MÔ HÌNH DỮ LIỆU & TYPESCRIPT INTERFACES

### 1.1. Core Interfaces

#### `PurchaseOrder` - Đơn đặt hàng chính
```typescript
interface PurchaseOrder {
  id: string;                          // UUID - Primary key
  order_date: string;                  // ISO 8601 - Ngày đặt hàng (user chọn)
  created_at: string;                  // ISO 8601 - Thời điểm tạo đơn
  updated_at: string;                  // ISO 8601 - Thời điểm cập nhật
  
  // Financial fields (stored in VND - actual value, e.g., 85000)
  invoice_amount: number;              // Số tiền trên hóa đơn gốc
  total_amount: number;                // Tổng tiền = SUM(items.purchase_price * quantity)
  final_amount: number;                // Thành tiền = total - discount + shipping
  discount_amount: number;             // Số tiền chiết khấu
  shipping_fee: number;                // Phí vận chuyển
  
  // Supplier info
  supplier_name: string | null;        // Tên NCC (uppercase)
  supplier_id?: string | null;         // ID NCC (reserved)
  
  // Status & metadata
  status: OrderStatus;                 // Trạng thái đơn hàng
  notes: string | null;                // Ghi chú (uppercase)
  invoice_images: string[] | null;     // URLs ảnh hóa đơn
  
  // Nested items
  items?: PurchaseOrderItem[];         // Danh sách sản phẩm
  
  // Computed flags (frontend only)
  hasShortage?: boolean;               // Có thiếu hàng (từ goods_receiving)
  hasDeletedProduct?: boolean;         // Có SP đã xóa
}

// Status enum values
type OrderStatus = 
  | 'draft'           // Nháp - Chưa hoàn tất
  | 'awaiting_export' // CHỜ MUA - Đã xác nhận, chờ xuất tiền
  | 'pending'         // CHỜ HÀNG - Đã mua, chờ NCC giao
  | 'received'        // Đã nhận hàng
  | 'completed'       // Hoàn thành
  | 'cancelled';      // Đã hủy
```

#### `PurchaseOrderItem` - Chi tiết sản phẩm trong đơn
```typescript
interface PurchaseOrderItem {
  id?: string;                         // UUID - Primary key (auto-generated)
  purchase_order_id?: string;          // FK to purchase_orders
  
  // Product info (snapshot - saved directly, không FK)
  product_code: string;                // Mã sản phẩm (VD: "N123", "P45")
  product_name: string;                // Tên sản phẩm
  variant: string | null;              // Biến thể: "38", "M", "Đỏ, M, 2"
  
  // Pricing (stored in VND)
  purchase_price: number;              // Giá mua 1 đơn vị
  selling_price: number;               // Giá bán niêm yết
  
  // Quantities
  quantity: number;                    // Số lượng đặt
  position?: number;                   // Thứ tự hiển thị (1-based)
  
  // Images
  product_images: string[] | null;     // URLs ảnh sản phẩm
  price_images: string[] | null;       // URLs ảnh báo giá
  
  // TPOS integration
  tpos_product_id?: number | null;     // ID sản phẩm trên TPOS
  tpos_sync_status?: string;           // 'pending' | 'processing' | 'success' | 'failed'
  selected_attribute_value_ids?: string[] | null; // UUIDs cho variant generation
  
  // Notes
  notes?: string | null;               // Ghi chú dòng
}
```

#### `ValidationSettings` - Cài đặt validation có thể tùy chỉnh
```typescript
interface ValidationSettings {
  // Price limits (đơn vị: 1000 VNĐ, e.g., 50 = 50.000đ)
  minPurchasePrice: number;            // Giá mua tối thiểu (0 = không giới hạn)
  maxPurchasePrice: number;            // Giá mua tối đa (0 = không giới hạn)
  minSellingPrice: number;             // Giá bán tối thiểu
  maxSellingPrice: number;             // Giá bán tối đa
  minMargin: number;                   // Chênh lệch tối thiểu (selling - purchase)
  
  // Boolean validation rules
  enableRequireProductName: boolean;   // Bắt buộc tên SP
  enableRequireProductCode: boolean;   // Bắt buộc mã SP
  enableRequireProductImages: boolean; // Bắt buộc hình ảnh
  enableRequirePositivePurchasePrice: boolean;  // Giá mua > 0
  enableRequirePositiveSellingPrice: boolean;   // Giá bán > 0
  enableRequireSellingGreaterThanPurchase: boolean; // Giá bán > Giá mua
  enableRequireAtLeastOneItem: boolean; // Ít nhất 1 sản phẩm
}

// Default settings
const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  minPurchasePrice: 0,
  maxPurchasePrice: 0,
  minSellingPrice: 0,
  maxSellingPrice: 0,
  minMargin: 0,
  enableRequireProductName: true,
  enableRequireProductCode: true,
  enableRequireProductImages: true,
  enableRequirePositivePurchasePrice: true,
  enableRequirePositiveSellingPrice: true,
  enableRequireSellingGreaterThanPurchase: true,
  enableRequireAtLeastOneItem: true,
};
```

### 1.2. Database Schema (Supabase PostgreSQL)

#### Table: `purchase_orders`
```sql
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id),     -- Optional FK to suppliers
  supplier_name TEXT,                                    -- Denormalized for quick display
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft',           -- Nháp
    'awaiting_export', -- CHỜ MUA (đã xác nhận, chờ xuất tiền)
    'pending',         -- CHỜ HÀNG (đã mua, chờ giao)  
    'received',        -- Đã nhận hàng
    'completed',       -- Hoàn thành
    'cancelled'        -- Đã hủy
  )),
  
  -- Financial fields (stored in VND, e.g., 85000)
  invoice_amount DECIMAL(15,2) DEFAULT 0,    -- Số tiền trên hóa đơn gốc
  total_amount DECIMAL(15,2) DEFAULT 0,      -- SUM(items.purchase_price * quantity)
  discount_amount DECIMAL(15,2) DEFAULT 0,   -- Chiết khấu
  shipping_fee DECIMAL(15,2) DEFAULT 0,      -- Phí vận chuyển
  final_amount DECIMAL(15,2) DEFAULT 0,      -- total - discount + shipping
  
  -- Documents
  invoice_number TEXT,
  invoice_date DATE,
  invoice_images TEXT[],                     -- URLs ảnh hóa đơn
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

-- RLS Policy
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on purchase_orders" 
  ON public.purchase_orders FOR ALL USING (true);
```

#### Table: `purchase_order_items`
```sql
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  
  -- Product snapshot (denormalized - not FK to products)
  product_code TEXT,                         -- Mã SP (e.g., "N123", "P45")
  product_name TEXT NOT NULL,                -- Tên SP
  variant TEXT,                              -- Biến thể: "38", "M,Đỏ"
  
  -- Pricing (VND)
  purchase_price DECIMAL(10,2) DEFAULT 0,    -- Giá mua 1 đơn vị
  selling_price DECIMAL(10,2) DEFAULT 0,     -- Giá bán niêm yết
  
  -- Quantities
  quantity INTEGER NOT NULL DEFAULT 1,
  position INTEGER,                          -- Thứ tự hiển thị (1-based)
  
  -- Images
  product_images TEXT[],                     -- URLs ảnh sản phẩm
  price_images TEXT[],                       -- URLs ảnh báo giá
  
  -- TPOS sync tracking
  tpos_product_id INTEGER,                   -- ID SP trên TPOS (null = chưa sync)
  tpos_sync_status TEXT DEFAULT 'pending' CHECK (tpos_sync_status IN (
    'pending',      -- Chờ xử lý
    'processing',   -- Đang xử lý
    'success',      -- Thành công
    'failed'        -- Thất bại
  )),
  tpos_sync_error TEXT,                      -- Lỗi sync (nếu có)
  tpos_sync_started_at TIMESTAMP WITH TIME ZONE,
  tpos_sync_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Variant generation
  selected_attribute_value_ids UUID[],       -- UUIDs cho TPOS variant API
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_purchase_order_items_order_id 
  ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_code 
  ON purchase_order_items(product_code);
CREATE INDEX idx_purchase_order_items_tpos_status 
  ON purchase_order_items(tpos_sync_status);

-- Partial index for background processing (only pending/failed items)
CREATE INDEX idx_purchase_order_items_pending_failed
  ON purchase_order_items(purchase_order_id, tpos_sync_status)
  WHERE tpos_sync_status IN ('pending', 'failed');

-- RLS Policy
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on purchase_order_items" 
  ON public.purchase_order_items FOR ALL USING (true);
```

#### Table: `purchase_order_validation_settings`
```sql
CREATE TABLE public.purchase_order_validation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Price limits (stored as integer, unit: 1000 VNĐ)
  min_purchase_price INTEGER NOT NULL DEFAULT 0,  -- 0 = không giới hạn
  max_purchase_price INTEGER NOT NULL DEFAULT 0,
  min_selling_price INTEGER NOT NULL DEFAULT 0,
  max_selling_price INTEGER NOT NULL DEFAULT 0,
  min_margin INTEGER NOT NULL DEFAULT 0,          -- Chênh lệch tối thiểu
  
  -- Boolean validation flags
  enable_require_product_name BOOLEAN DEFAULT TRUE,
  enable_require_product_code BOOLEAN DEFAULT TRUE,
  enable_require_product_images BOOLEAN DEFAULT TRUE,
  enable_require_positive_purchase_price BOOLEAN DEFAULT TRUE,
  enable_require_positive_selling_price BOOLEAN DEFAULT TRUE,
  enable_require_selling_greater_than_purchase BOOLEAN DEFAULT TRUE,
  enable_require_at_least_one_item BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- RLS: Users can only access their own settings
ALTER TABLE public.purchase_order_validation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own validation settings"
  ON purchase_order_validation_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own validation settings"
  ON purchase_order_validation_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own validation settings"
  ON purchase_order_validation_settings FOR UPDATE USING (auth.uid() = user_id);
```

#### Table: `suppliers`
```sql
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  contact_person TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### Table: `goods_receiving` (Phiếu nhập kho)
```sql
CREATE TABLE public.goods_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  has_discrepancy BOOLEAN DEFAULT FALSE,     -- Có sai lệch?
  total_items_expected INTEGER DEFAULT 0,
  total_items_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.goods_receiving_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receiving_id UUID NOT NULL REFERENCES goods_receiving(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  product_code TEXT,
  product_name TEXT,
  variant TEXT,
  expected_quantity INTEGER DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  discrepancy_type TEXT CHECK (discrepancy_type IN ('shortage', 'excess', 'none')),
  discrepancy_quantity INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

### 1.3. RPC Functions (PostgreSQL Functions)

#### `get_max_product_code_number` - Optimized code generation
```sql
-- Tìm số lớn nhất trong mã SP theo category (N, P, Q)
-- Dùng cho auto-generate product code
CREATE OR REPLACE FUNCTION public.get_max_product_code_number(
  category_prefix text,
  table_name text DEFAULT 'products'
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_number integer := 0;
  product_code_val text;
  extracted_number text;
BEGIN
  -- Validate table name (prevent SQL injection)
  IF table_name NOT IN ('products', 'purchase_order_items') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  -- Query all product codes matching the prefix
  FOR product_code_val IN
    EXECUTE format(
      'SELECT product_code FROM %I WHERE product_code LIKE $1 || ''%%''',
      table_name
    )
    USING category_prefix
  LOOP
    -- Extract trailing digits using regex
    extracted_number := substring(product_code_val FROM '\d+$');
    
    IF extracted_number IS NOT NULL THEN
      max_number := GREATEST(max_number, extracted_number::integer);
    END IF;
  END LOOP;
  
  RETURN max_number;
END;
$$;

-- Usage example:
-- SELECT get_max_product_code_number('N', 'products');       -- → 1234
-- SELECT get_max_product_code_number('P', 'purchase_order_items'); -- → 567
```

#### `update_updated_at_column` - Auto timestamp trigger
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_order_validation_settings_updated_at
  BEFORE UPDATE ON purchase_order_validation_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### `update_product_stock_on_receiving` - Stock upsert trigger
```sql
-- Trigger khi nhận hàng → tự động cập nhật/tạo sản phẩm trong kho
CREATE OR REPLACE FUNCTION public.update_product_stock_on_receiving()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert product with stock_quantity
  INSERT INTO public.products (
    product_code, product_name, variant,
    selling_price, purchase_price, stock_quantity, ...
  )
  VALUES (NEW.product_code, NEW.product_name, ...)
  ON CONFLICT (product_code)
  DO UPDATE SET
    stock_quantity = products.stock_quantity + NEW.received_quantity,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_goods_receiving_item_insert
  AFTER INSERT ON goods_receiving_items
  FOR EACH ROW EXECUTE FUNCTION update_product_stock_on_receiving();
```

---

### 1.4. Storage Bucket

```sql
-- Bucket for purchase order images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('purchase-images', 'purchase-images', true);

-- Storage policy
CREATE POLICY "Allow all operations on purchase images" 
  ON storage.objects FOR ALL 
  USING (bucket_id = 'purchase-images');
```

---

### 1.5. Edge Functions (Supabase Deno Functions)

#### `process-purchase-order-background`
**Path:** `supabase/functions/process-purchase-order-background/index.ts`

**Purpose:** Background TPOS sync processing với retry logic

**Input:**
```typescript
interface RequestBody {
  purchase_order_id: string;
  imageCache?: Record<string, string>; // URL → base64 mapping
}
```

**Logic:**
```
1. CLEANUP stuck items (processing > 5 minutes)
2. CHECK order exists (prevent crash if deleted)
3. FETCH items with status = 'pending' or 'failed', tpos_product_id = null
4. GROUP items by (product_code + selected_attribute_value_ids)
5. PROCESS groups in parallel batches (MAX_CONCURRENT = 8)
   - For each group:
     a. Lock items (set status = 'processing')
     b. Call create-tpos-variants-from-order function
     c. Retry on 429 (rate limit) with exponential backoff
     d. Mark success/failed
6. UPDATE final status for all processed items
7. RETURN summary: { total, succeeded, failed, errors }
```

**Output:**
```typescript
interface Response {
  success: boolean;
  tpos_sync: {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  };
}
```

#### Other Related Edge Functions
| Function | Purpose |
|----------|---------|
| `create-tpos-variants-from-order` | Tạo SP + variants trên TPOS |
| `sync-tpos-images` | Sync hình ảnh lên TPOS |
| `refresh-tpos-token` | Refresh access token TPOS |
| `stock-change-post-qty` | Cập nhật tồn kho TPOS |

### 2.1. TanStack Query Configuration

#### Query Keys Structure
```typescript
// Query keys for cache management
const QUERY_KEYS = {
  // Main data
  purchaseOrders: {
    draft: ["purchase-orders", "draft"],
    awaitingPurchase: ["purchase-orders", "awaiting_purchase"],
    awaitingDelivery: ["purchase-orders", "awaiting_delivery"],
    stats: ["purchase-orders-stats"],
  },
  // Validation settings
  validationSettings: ["purchase-order-validation-settings"],
  // Sync status
  syncStatus: (orderIds: string[]) => ["order-sync-status", orderIds],
  // Variant info
  variantStockInfo: (productCodes: string[]) => ["variant-stock-info", productCodes],
};
```

### 2.2. Supabase Queries

#### Query 1: Draft Orders (Tab "Nháp")
```typescript
const { data: draftOrders } = useQuery({
  queryKey: ["purchase-orders", "draft"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        items:purchase_order_items(
          id, quantity, position, notes,
          product_code, product_name, variant,
          purchase_price, selling_price,
          product_images, price_images,
          tpos_product_id, selected_attribute_value_ids
        )
      `)
      .eq("status", "draft")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    return data.map(order => ({
      ...order,
      items: order.items.sort((a, b) => (a.position || 0) - (b.position || 0)),
      hasShortage: false,
      hasDeletedProduct: false
    }));
  },
  enabled: activeTab === "drafts",
  staleTime: 30000, // 30 seconds
});
```

#### Query 2: Awaiting Purchase Orders (Tab "Chờ mua")
```typescript
// Same structure as draft, but:
.eq("status", "awaiting_export")
enabled: activeTab === "awaiting_purchase"
```

#### Query 3: Awaiting Delivery Orders (Tab "Chờ hàng")
```typescript
// Includes goods_receiving join for shortage detection
.select(`
  *,
  items:purchase_order_items(...),
  receiving:goods_receiving(
    id, has_discrepancy,
    items:goods_receiving_items(discrepancy_type, discrepancy_quantity)
  )
`)
.eq("status", "pending")

// Post-process: Check shortage
hasShortage = order.receiving?.[0]?.items?.some(
  item => item.discrepancy_type === 'shortage'
);
```

#### Query 4: Stats (Lightweight - No items)
```typescript
const { data: allOrdersForStats } = useQuery({
  queryKey: ["purchase-orders-stats"],
  queryFn: async () => {
    const { data } = await supabase
      .from("purchase_orders")
      .select(`id, status, total_amount, final_amount, created_at, ...`)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    
    return data.map(order => ({ ...order, items: [] }));
  },
  staleTime: 60000, // 1 minute
});
```

### 2.3. Mutations

#### Create/Update Draft
```typescript
const saveDraftMutation = useMutation({
  mutationFn: async () => {
    // Calculate amounts
    const totalAmount = items.reduce((sum, item) => 
      sum + item._tempTotalPrice, 0) * 1000; // Convert from thousands
    const discountAmount = formData.discount_amount * 1000;
    const shippingFee = formData.shipping_fee * 1000;
    const finalAmount = totalAmount - discountAmount + shippingFee;

    if (initialData?.id) {
      // UPDATE existing draft
      await supabase.from("purchase_orders").update({...}).eq("id", id);
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
      // Re-insert items
    } else {
      // INSERT new draft
      const { data: order } = await supabase.from("purchase_orders").insert({
        status: 'draft',
        ...
      }).select().single();
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  }
});
```

#### Create Order (Submit - Confirm Purchase)
```typescript
const createOrderMutation = useMutation({
  mutationFn: async () => {
    // STEP 1: Validate supplier
    if (!formData.supplier_name?.trim()) throw new Error("...");
    
    // STEP 2: Validate items
    if (items.length === 0) throw new Error("...");
    
    // STEP 3: Validate each item (price settings, required fields)
    const validationErrors = [];
    items.forEach((item, index) => {
      // validatePriceSettings() + field checks
    });
    
    // STEP 4: Insert order with status = 'awaiting_export'
    const { data: order } = await supabase.from("purchase_orders").insert({
      status: 'awaiting_export', // CHỜ MUA
      ...
    }).select().single();
    
    // STEP 5: Insert items
    // STEP 6: Trigger TPOS sync (optional)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    // Show sonner toast with processing progress
  }
});
```

#### Delete Order (With Cascade)
```typescript
const deletePurchaseOrderMutation = useMutation({
  mutationFn: async (orderId: string) => {
    // CRITICAL: Must delete in correct order to avoid FK violations
    
    // Step 1: Get all item IDs
    const { data: itemIds } = await supabase
      .from("purchase_order_items")
      .select("id")
      .eq("purchase_order_id", orderId);

    // Step 2: Delete goods_receiving_items (children of items)
    if (itemIds?.length > 0) {
      await supabase
        .from("goods_receiving_items")
        .delete()
        .in("purchase_order_item_id", itemIds.map(i => i.id));
    }

    // Step 3: Delete goods_receiving (parent of receiving items)
    await supabase
      .from("goods_receiving")
      .delete()
      .eq("purchase_order_id", orderId);

    // Step 4: Delete purchase_order_items
    await supabase
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", orderId);

    // Step 5: Delete purchase_order (finally!)
    await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", orderId);
  }
});
```

---

## 3. DANH SÁCH CÁC HÀM XỬ LÝ (CORE FUNCTIONS)

### A. Hàm tính toán (Utilities)

#### Currency Formatting
```typescript
// File: lib/currency-utils.ts
export function formatVND(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

// Usage:
formatVND(85000) // → "85.000 đ"
```

#### Amount Calculations
```typescript
// Calculate total amount (sum of all items)
const totalAmount = items.reduce((sum, item) => 
  sum + (Number(item.purchase_price) * item.quantity), 0
) * 1000; // UI stores in thousands

// Calculate final amount
const finalAmount = totalAmount - discountAmount + shippingFee;
```

#### Variant Matching (Intelligent)
```typescript
// File: PurchaseOrders.tsx
const variantsMatch = (variant1: string | null, variant2: string | null): boolean => {
  if (!variant1 || !variant2) return false;
  
  // Normalize: uppercase, remove accents, remove parentheses
  const normalize = (str: string) => 
    convertVietnameseToUpperCase(str.trim())
      .replace(/[()]/g, '')
      .replace(/\s+/g, ' ');
  
  // Split by comma or pipe, sort, compare as sets (order-insensitive)
  const parts1 = variant1.split(/[,|]/).map(p => normalize(p)).sort();
  const parts2 = variant2.split(/[,|]/).map(p => normalize(p)).sort();
  
  if (parts1.length !== parts2.length) return false;
  return parts1.every((part, idx) => part === parts2[idx]);
};

// Examples that match:
// "CÀ PHÊ, 2, M" ↔ "2, Cà Phê, M"
// "Đỏ,S,1" ↔ "1, S, Đỏ"
```

### B. Auto Product Code Generation

```typescript
// File: lib/product-code-generator.ts

// Category detection based on product name
export function detectProductCategory(productName: string): 'N' | 'P' | 'Q' | null {
  const normalized = convertVietnameseToUpperCase(productName);
  const tokens = normalized.split(/\s+/);
  
  // Step 1: Skip date token (ddmm format)
  // Step 2: Check NCC pattern (Q5 → 'Q', A12 → continue)
  // Step 3: Check loại SP keywords
  
  const CATEGORY_N_KEYWORDS = ["QUAN", "AO", "DAM", "SET", "JUM"];       // Quần áo
  const CATEGORY_P_KEYWORDS = ["TUI", "GIAY", "DEP", "KHAN", "SON"];    // Phụ kiện
  
  // Q pattern → return 'Q'
  // N keywords → return 'N'
  // P keywords → return 'P'
  // Default with valid structure → 'N'
  // Not enough info → null
}

// Check if code exists in DB + TPOS
export async function isProductCodeExists(
  code: string,
  formItems: Array<{ product_code: string }>
): Promise<boolean> {
  // 1. Check current form items
  // 2. Check purchase_order_items table
  // 3. Check products table
  return existsInForm || existsInPOItems || existsInProducts;
}
```

### C. Event Handlers

#### `handleCopyOrder` - Clone đơn hàng
```typescript
const handleCopyOrder = async (order: PurchaseOrder) => {
  // 1. Insert new draft order with copied data (except id)
  const { data: newOrder } = await supabase
    .from('purchase_orders')
    .insert({
      order_date: new Date().toISOString(), // New date
      status: 'draft', // Always start as draft
      ...copyFieldsFromOrder(order)
    })
    .select().single();

  // 2. Copy all items
  const copiedItems = order.items.map((item, index) => ({
    purchase_order_id: newOrder.id,
    position: index,
    tpos_sync_status: 'pending', // Reset sync status
    ...copyFieldsFromItem(item)
  }));
  
  await supabase.from('purchase_order_items').insert(copiedItems);

  // 3. Switch to drafts tab
  setActiveTab('drafts');
  queryClient.invalidateQueries({ queryKey: ['purchase-orders', 'drafts'] });
};
```

#### `handleExportPurchaseExcel` - Xuất Excel Mua Hàng
```typescript
const handleExportPurchaseExcel = async (singleOrder?: PurchaseOrder) => {
  // STEP 1: Determine order to export (single or selected)
  // STEP 2: Validate exactly 1 order selected
  // STEP 3: Get items from order
  
  const excelRows = [];
  const skippedItems = [];

  for (const item of allItems) {
    // CASE 1: Already has tpos_product_id → Use directly
    if (item.tpos_product_id != null) {
      excelRows.push({ "Mã sản phẩm (*)": item.product_code, ... });
      continue;
    }

    // CASE 2: No variant → Use product_code directly
    if (!item.variant || item.variant.trim() === '') {
      excelRows.push({ ... });
      continue;
    }

    // CASE 3: Has variant → 3-step fallback matching
    // Step 3.1: Find variant match in products table
    const candidates = await supabase.from('products')
      .select('product_code, variant')
      .eq('base_product_code', item.product_code);
    
    const matched = candidates.find(p => variantsMatch(p.variant, item.variant));
    if (matched) {
      excelRows.push({ "Mã sản phẩm (*)": matched.product_code, ... });
      continue;
    }

    // Step 3.2: Check exact product_code in warehouse
    const exactMatch = await supabase.from('products')
      .select('product_code')
      .eq('product_code', item.product_code)
      .maybeSingle();
    
    if (exactMatch) {
      excelRows.push({ ... });
      continue;
    }

    // Step 3.3: Check TPOS API
    const tposProduct = await searchTPOSProduct(item.product_code);
    if (tposProduct) {
      excelRows.push({ ... });
      continue;
    }

    // FINAL: Not found anywhere → SKIP
    skippedItems.push(`❌ ${item.product_code} (${item.variant})`);
  }

  // STEP 4: Generate Excel file
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mua Hàng");
  XLSX.writeFile(wb, `MuaHang_${supplier}_${date}.xlsx`);

  // STEP 5: Auto-update status if still awaiting_export
  if (order.status === 'awaiting_export') {
    await supabase.from('purchase_orders')
      .update({ status: 'pending' })
      .eq('id', order.id);
  }
};
```

### D. Validation Functions

```typescript
const validateItems = (): { isValid: boolean; invalidFields: string[] } => {
  const invalidFields: string[] = [];
  
  // CHECK: At least one item
  if (settings.enableRequireAtLeastOneItem && items.length === 0) {
    invalidFields.push("Phải có ít nhất 1 sản phẩm");
  }
  
  items.forEach((item, i) => {
    const num = i + 1;
    
    // CHECK: Product name
    if (settings.enableRequireProductName && !item.product_name?.trim()) {
      invalidFields.push(`Dòng ${num}: Thiếu tên sản phẩm`);
    }
    
    // CHECK: Product code
    if (settings.enableRequireProductCode && !item.product_code?.trim()) {
      invalidFields.push(`Dòng ${num}: Thiếu mã sản phẩm`);
    }
    
    // CHECK: Purchase price > 0
    if (settings.enableRequirePositivePurchasePrice && Number(item.purchase_price) <= 0) {
      invalidFields.push(`Dòng ${num}: Giá mua phải > 0`);
    }
    
    // CHECK: Selling price > 0
    if (settings.enableRequirePositiveSellingPrice && Number(item.selling_price) <= 0) {
      invalidFields.push(`Dòng ${num}: Giá bán phải > 0`);
    }
    
    // CHECK: Selling > Purchase
    if (settings.enableRequireSellingGreaterThanPurchase && 
        Number(item.selling_price) <= Number(item.purchase_price)) {
      invalidFields.push(`Dòng ${num}: Giá bán phải lớn hơn giá mua`);
    }
    
    // CHECK: Product images
    if (settings.enableRequireProductImages && 
        (!item.product_images || item.product_images.length === 0)) {
      invalidFields.push(`Dòng ${num}: Thiếu hình ảnh sản phẩm`);
    }
  });
  
  return { isValid: invalidFields.length === 0, invalidFields };
};
```

---

## 4. STATE MANAGEMENT FLOW

### 4.1. Local State (Component Level)

#### PurchaseOrders.tsx (Main Page)
```typescript
// Dialog control
const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
const [draftToEdit, setDraftToEdit] = useState<PurchaseOrder | null>(null);

// Tab & Selection
const [activeTab, setActiveTab] = useState<string>("drafts");
const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

// Filters (shared between tabs)
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState<string>("awaiting_export");
const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
const [quickFilter, setQuickFilter] = useState<string>("all");

// Separate filter state for Drafts tab
const [searchTermDraft, setSearchTermDraft] = useState("");
const [dateFromDraft, setDateFromDraft] = useState<Date | undefined>(undefined);
const [dateToDraft, setDateToDraft] = useState<Date | undefined>(undefined);
const [quickFilterDraft, setQuickFilterDraft] = useState<string>("all");
```

#### CreatePurchaseOrderDialog.tsx (Form)
```typescript
// Form data
const [formData, setFormData] = useState({
  supplier_name: "",
  order_date: new Date().toISOString(),
  notes: "",
  invoice_images: [],
  invoice_amount: 0,      // UI: thousands (50 = 50.000đ)
  discount_amount: 0,
  shipping_fee: 0
});

// Items array
const [items, setItems] = useState<PurchaseOrderItem[]>([{
  quantity: 1, notes: "", product_code: "", product_name: "",
  variant: "", purchase_price: 0, selling_price: 0,
  product_images: [], price_images: [], _tempTotalPrice: 0
}]);

// UI states
const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
const [showValidationSettings, setShowValidationSettings] = useState(false);
const [manualProductCodes, setManualProductCodes] = useState<Set<number>>(new Set());
```

### 4.2. Memoized Derived State

```typescript
// Filtered orders (recalculated when dependencies change)
const filteredAwaitingPurchaseOrders = useMemo(() => {
  return (awaitingPurchaseOrders || []).filter(order => {
    // Date range filter
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.created_at);
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
    }
    
    // Search filter
    const matchesSearch = searchTerm === "" || 
      order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      format(new Date(order.created_at), "dd/MM").includes(searchTerm) ||
      order.items?.some(item => 
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    return matchesSearch;
  });
}, [awaitingPurchaseOrders, dateFrom, dateTo, searchTerm]);
```

### 4.3. Cache Invalidation Pattern

```typescript
// After successful mutation
onSuccess: () => {
  // Invalidate all purchase order queries
  queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  
  // Also invalidate stats
  queryClient.invalidateQueries({ queryKey: ["purchase-orders-stats"] });
  
  // Close dialog
  onOpenChange(false);
  resetForm();
}
```

---

## 5. PSEUDO-CODE CHO LOGIC PHỨC TẠP

### 5.1. Auto Product Code Generation Flow

```
ALGORITHM: AutoGenerateProductCode

INPUT: productName (string), formItems (array), manualCodes (Set)
OUTPUT: productCode (string) or null

1. IF productName is empty OR already has code OR manualCodes.has(index)
     RETURN null (skip)

2. DETECT category from productName:
     - Parse tokens: ["2512", "A62", "AO", "THUN", ...]
     - Skip date token if present (ddmm format)
     - Check NCC token:
       - If Q pattern (Q5, Q12) → category = 'Q'
       - If A pattern (A12, B5) → continue to loại SP
     - Check loại SP:
       - N keywords (QUAN, AO, DAM) → category = 'N'
       - P keywords (TUI, GIAY, DEP) → category = 'P'
     - Default with valid structure → 'N'
     - No info → null (abort)

3. GET max number from 3 sources (parallel):
     maxFromProducts = DB.rpc('get_max_product_code_number', 'products', category)
     maxFromPOItems = DB.rpc('get_max_product_code_number', 'purchase_order_items', category)
     maxFromForm = scan formItems for max number in category

4. nextNumber = MAX(maxFromProducts, maxFromPOItems, maxFromForm) + 1
   candidateCode = category + nextNumber

5. LOOP (max 30 attempts):
     a. IF candidateCode exists in form → increment, continue
     b. IF candidateCode exists in DB → increment, continue
     c. IF candidateCode exists on TPOS API → increment, continue
     d. BREAK (code is available)

6. IF attempts >= 30:
     SHOW ERROR TOAST: "Mã trùng trên TPOS hơn 30 mã"
     RETURN null

7. ASSIGN candidateCode to item.product_code
   RETURN candidateCode
```

### 5.2. Row Spanning Table Rendering

```
ALGORITHM: FlattenOrdersForTable

INPUT: orders (PurchaseOrder[])
OUTPUT: flattenedItems (array of rows)

1. FOREACH order in orders:
     IF order.items is empty:
       ADD single row: { ...order, item: null, itemCount: 1, isFirstItem: true }
     ELSE:
       FOREACH (item, index) in order.items:
         ADD row: {
           ...order,
           item: item,
           itemCount: order.items.length,
           isFirstItem: (index === 0)
         }

2. RENDER TABLE:
     FOREACH flatItem in flattenedItems:
       <TableRow>
         IF flatItem.isFirstItem:
           // Order-level columns with rowSpan
           <TableCell rowSpan={flatItem.itemCount}>Ngày đặt</TableCell>
           <TableCell rowSpan={flatItem.itemCount}>NCC</TableCell>
           <TableCell rowSpan={flatItem.itemCount}>Hóa đơn</TableCell>
         
         // Item-level columns (always render)
         <TableCell>Tên SP</TableCell>
         <TableCell>Mã SP</TableCell>
         <TableCell>Biến thể</TableCell>
         <TableCell>SL</TableCell>
         <TableCell>Giá mua</TableCell>
         <TableCell>Giá bán</TableCell>
         
         IF flatItem.isFirstItem:
           // Trailing order-level columns
           <TableCell rowSpan={flatItem.itemCount}>Ghi chú</TableCell>
           <TableCell rowSpan={flatItem.itemCount}>Trạng thái</TableCell>
           <TableCell rowSpan={flatItem.itemCount}>Thao tác</TableCell>
       </TableRow>
```

### 5.3. Excel Export with TPOS Matching

```
ALGORITHM: ExportPurchaseExcel

INPUT: order (PurchaseOrder)
OUTPUT: Excel file (.xlsx)

1. VALIDATE: Must have exactly 1 order, must have items

2. FOREACH item in order.items:
     // CASE 1: Already synced to TPOS
     IF item.tpos_product_id != null:
       ADD TO excel: { code: item.product_code, qty, price }
       CONTINUE
     
     // CASE 2: No variant
     IF item.variant is empty:
       ADD TO excel: { code: item.product_code, qty, price }
       CONTINUE
     
     // CASE 3: Has variant - need matching
     // Step 3.1: Find variant in products table
     candidates = DB.select('products')
       .where('base_product_code', item.product_code)
       .whereNotNull('variant')
     
     matched = candidates.find(p => variantsMatch(p.variant, item.variant))
     IF matched:
       ADD TO excel: { code: matched.product_code, qty, price }
       CONTINUE
     
     // Step 3.2: Fallback - check exact code in warehouse
     exactMatch = DB.select('products').where('product_code', item.product_code)
     IF exactMatch:
       ADD TO excel: { code: item.product_code, qty, price }
       CONTINUE
     
     // Step 3.3: Check TPOS API
     tposProduct = TPOS.search(item.product_code)
     IF tposProduct:
       ADD TO excel: { code: item.product_code, qty, price }
       CONTINUE
     
     // FINAL: Not found - SKIP with error
     skippedItems.push(item)

3. GENERATE Excel:
     ws = XLSX.json_to_sheet(excelRows)
     wb = XLSX.book_new()
     XLSX.book_append_sheet(wb, ws, "Mua Hàng")
     XLSX.writeFile(wb, filename)

4. SHOW TOAST with results and skipped items

5. IF order.status === 'awaiting_export':
     UPDATE order.status = 'pending'
     INVALIDATE queries
```

---

## 6. DEPENDENCIES & LIBRARIES

### Required Packages
```json
{
  "@tanstack/react-query": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "xlsx": "^0.18.x",
  "date-fns": "^2.x",
  "lucide-react": "^0.x",
  "sonner": "^1.x"
}
```

### UI Components (shadcn/ui)
- Dialog, AlertDialog
- Button, Input, Textarea
- Table, Tabs
- Select, Popover, Calendar
- Badge, Checkbox
- Tooltip, HoverCard

### Custom Hooks
- `useToast` - Toast notifications
- `useDebounce` - Debounced values
- `useIsMobile` - Responsive detection
- `useAuth` - User authentication context

---

## 7. ADDITIONAL NOTES

### 7.1. Price Storage Convention
- **Database**: Stored in actual VND (e.g., 85000)
- **UI Form**: Displayed/input in thousands (e.g., 85)
- **Conversion**: Multiply by 1000 when saving, divide when loading

### 7.2. Status Transition Rules
```
draft → awaiting_export (Submit)
draft → (deleted)

awaiting_export → pending (After Excel export)
awaiting_export → draft (Cancel confirmation)

pending → received (After goods receiving)
pending → cancelled (Cancel order)

received → completed (After verification)
```

### 7.3. TPOS Integration
- Product lookup: `searchTPOSProduct(code)`
- Sync status tracking: `tpos_sync_status` field
- Background processing with polling updates
- 3-second delay after processing before unlock

---

**Tài liệu này đảm bảo AI Developer có thể triển khai lại tính năng Purchase Orders một cách chính xác 100%.**
