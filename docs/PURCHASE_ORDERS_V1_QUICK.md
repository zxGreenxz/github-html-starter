# 📦 Purchase Orders V1 - Quick Reference Guide

> **Dành cho:** Developers cần hiểu nhanh flow và debug  
> **Thời gian đọc:** ~10 phút  
> **Phiên bản đầy đủ:** [PURCHASE_ORDERS_V1.md](./PURCHASE_ORDERS_V1.md)

---

## 📋 Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Module Map](#module-map)
3. [Flow Chi Tiết](#flow-chi-tiết)
4. [Debug Checklist](#debug-checklist)
5. [Quick Reference](#quick-reference)
6. [Top 5 Known Issues](#top-5-known-issues)

---

## 🎯 Tổng Quan

### Mục Đích
Hệ thống đặt hàng NCC với:  
- ✅ Background processing (không block UI)  
- ✅ Variant generation (tạo biến thể tự động)  
- ✅ TPOS sync (đồng bộ với Tomato POS)  
- ✅ Real-time progress tracking  

### Kiến Trúc Tổng Quát
```
User Input (Dialog)
    ↓
Save to DB (purchase_orders + items)
    ↓
Invoke Edge Function (NO AWAIT ✅)
    ↓
Dialog closes immediately
    ↓
Polling progress (5s interval)
    ↓
Edge Function → TPOS API
    ↓
Update item status (success/failed)
```

### Số Liệu Chính
- **Database Tables:** 4 chính (purchase_orders, purchase_order_items, products, product_attribute_values)  
- **Edge Functions:** 2 (process-purchase-order-background, create-tpos-variants-from-order)  
- **UI Components:** 3 dialogs (Create, Detail, VariantGenerator)  
- **Polling:** 5s interval, 3min timeout  
- **TPOS Price Multiplier:** x1000 (100 → 100,000 VND)  

---

## 🗺️ Module Map

### Frontend Modules
```
src/components/purchase-orders/
├── CreatePurchaseOrderDialog.tsx (850 dòng)
│   ├── State Management (Lines 50-100)
│   │   ├── supplierName, orderDate, notes
│   │   ├── items[] (product_code, name, prices, images)
│   │   └── Dialog states (editing, uploading)
│   │
│   ├── Mutations (Lines 200-670)
│   │   ├── createOrderMutation (Lines 580-670)
│   │   │   ├── INSERT purchase_orders
│   │   │   ├── INSERT purchase_order_items
│   │   │   ├── Invoke background function (NO AWAIT)
│   │   │   └── Start polling
│   │   ├── updateOrderMutation (Lines 415-555)
│   │   │   ⚠️ DELETE + INSERT (no transaction)
│   │   └── saveDraftMutation
│   │
│   ├── Polling Logic (Lines 720-792)
│   │   ├── pollTPOSProcessingProgress()
│   │   ├── Query sync status every 5s
│   │   ├── Update toast "X/N sản phẩm"
│   │   └── ⚠️ No cleanup on unmount
│   │
│   └── UI Rendering (Lines 500-850)
│       ├── Order info inputs
│       ├── Items table with inline editing
│       └── Image upload cells
│
├── PurchaseOrderDetailDialog.tsx (400 dòng)
│   ├── Display order + items
│   ├── Show sync status badges
│   └── Retry Logic (Lines 94-137)
│       ├── Reset failed items to 'pending'
│       ├── Invoke background function
│       └── ⚠️ Awaits function (blocks UI)
│
├── PurchaseOrderList.tsx (500 dòng)
│   ├── Fetch orders with filters
│   ├── Status Badge Query (Lines 234-259)
│   │   ├── Aggregate item statuses
│   │   ├── Show "Đang xử lý / X lỗi / Hoàn thành"
│   │   └── ⚠️ No refetchInterval (not auto-refreshing)
│   └── Actions (View, Edit, Delete)
│
└── VariantGeneratorDialog.tsx
    ├── Select attributes from DB
    ├── Calculate Cartesian product
    └── Return selected_attribute_value_ids[]
```

### Backend Modules
```
supabase/functions/
├── process-purchase-order-background/index.ts (300 dòng)
│   ├── Input: { purchase_order_id: UUID }
│   ├── Fetch items WHERE status IN ('pending', 'failed')
│   ├── Item Loop (Lines 82-200)
│   │   ├── Lock Check (Lines 84-103)
│   │   │   └── UPDATE WHERE status = old_status (atomic)
│   │   ├── Invoke create-tpos-variants-from-order
│   │   └── Update status (success/failed)
│   ├── Error Handling (Lines 150-200)
│   │   ├── Try-catch per item
│   │   ├── Save error to tpos_sync_error
│   │   └── Continue with next item
│   └── Output: { succeeded, failed, errors[] }
│
└── create-tpos-variants-from-order/index.ts (800 dòng)
    ├── Input: { baseProductCode, productName, prices, images, attributeValueIds }
    ├── Case 1: Simple Product (Lines 100-300)
    │   ├── Convert image to base64
    │   ├── Build TPOS payload
    │   ├── POST to TPOS API
    │   └── UPSERT to products table
    ├── Case 2: Product with Variants (Lines 400-700)
    │   ├── Fetch attribute values (tpos_id, tpos_attribute_id)
    │   ├── Generate Cartesian product (combinations)
    │   ├── Build parent + children payload
    │   ├── POST to TPOS API
    │   └── UPSERT parent + children to products
    └── Output: { tpos_product_id, variant_count }
```

---

## 🔄 Flow Chi Tiết

### Flow 1: Tạo Đơn Hàng (Create Order)

#### 📝 Step 1: User Input
**File:** `CreatePurchaseOrderDialog.tsx` (Lines 150-200)

**Input:**
```typescript
{
  supplierName: string,        // Required
  orderDate: Date,             // Default: today
  notes: string,               // Optional
  invoiceNumber: string,       // Optional
  invoiceDate: Date,           // Optional
  invoiceImages: string[],     // URLs after upload
  items: [
    {
      product_code: string,      // Required, UNIQUE in order
      product_name: string,      // Required
      variant: string,           // Optional
      purchase_price: number,    // Required, > 0
      selling_price: number,     // Required, > 0
      quantity: number,          // Default: 1
      product_images: string[],  // URLs
      price_images: string[],    // URLs
      notes: string,             // Optional
      selected_attribute_value_ids: UUID[] // For variants
    }
  ]
}
```

**Validation:**
```typescript
// Check duplicate product_code
const codes = items.map(i => i.product_code);
const hasDuplicate = new Set(codes).size !== codes.length;
if (hasDuplicate) {
  toast.error("Mã sản phẩm bị trùng");
  return;
}

// Check prices
items.forEach(item => {
  if (item.purchase_price <= 0 || item.selling_price <= 0) {
    toast.error("Giá phải > 0");
    return;
  }
});
```

#### 💾 Step 2: Save to Database
**Mutation:** `createOrderMutation` (Lines 580-650)

```typescript
// 1. Insert order
const { data: order } = await supabase
  .from("purchase_orders")
  .insert({
    supplier_name: supplierName,
    order_date: orderDate.toISOString(),
    notes: notes,
    status: "pending", // ← Not draft
    // ... invoice fields
  })
  .select()
  .single();

// 2. Insert items
const itemsToInsert = items.map((item, index) => ({
  purchase_order_id: order.id,
  position: index + 1,
  product_code: item.product_code,
  product_name: item.product_name,
  // ... all fields
  tpos_sync_status: 'pending', // ← Initial status
}));

await supabase
  .from("purchase_order_items")
  .insert(itemsToInsert);
```

#### 🚀 Step 3: Invoke Background Function
**Code:** Lines 658-671

```typescript
// ✅ NO AWAIT - Fire and forget
supabase.functions.invoke(
  'process-purchase-order-background',
  { body: { purchase_order_id: order.id } }
).catch(error => {
  console.error('Failed to invoke:', error);
  toast.error("Không thể bắt đầu xử lý");
});
```

**Why NO AWAIT?**  
- Dialog đóng ngay lập tức (UX tốt)  
- Background function chạy async  
- UI không bị block  

#### 🔄 Step 4: Polling Progress
**Function:** `pollTPOSProcessingProgress` (Lines 720-792)

```typescript
const POLL_INTERVAL = 5000; // 5 giây
const MAX_DURATION = 180000; // 3 phút
const startTime = Date.now();

const pollInterval = setInterval(async () => {
  // Check timeout
  if (Date.now() - startTime > MAX_DURATION) {
    clearInterval(pollInterval);
    toast.error("Hết thời gian xử lý");
    return;
  }

  // Query sync status
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('tpos_sync_status')
    .eq('purchase_order_id', orderId);

  const successCount = items.filter(i => i.tpos_sync_status === 'success').length;
  const failedCount = items.filter(i => i.tpos_sync_status === 'failed').length;
  const completedCount = successCount + failedCount;

  // Update toast
  if (completedCount < totalItems) {
    toast.loading(`Đang xử lý ${completedCount}/${totalItems}...`, { id: toastId });
  } else {
    // Done
    clearInterval(pollInterval);
    if (failedCount === 0) {
      toast.success(`✅ Hoàn thành ${successCount} sản phẩm`);
    } else {
      toast.warning(`⚠️ ${successCount} thành công, ${failedCount} lỗi`);
    }
  }
}, POLL_INTERVAL);
```

**⚠️ Vấn đề:**  
- `pollInterval` không cleanup khi component unmount  
- Memory leak nếu user đóng page  

#### ✅ Step 5: Completion
- **Success:** Toast "✅ Hoàn thành N sản phẩm"  
- **Partial:** Toast "⚠️ X thành công, Y lỗi"  
- **Failed:** Toast "❌ Tất cả lỗi"  

---

### Flow 2: Background Processing (Edge Function)

#### 🔍 Step 1: Fetch Pending Items
**File:** `process-purchase-order-background/index.ts` (Lines 50-80)

```typescript
// Validate input
const { purchase_order_id } = await req.json();
if (!purchase_order_id) throw new Error('Missing purchase_order_id');

// Check order exists
const { data: order } = await supabase
  .from('purchase_orders')
  .select('id, supplier_name')
  .eq('id', purchase_order_id)
  .single();

if (!order) throw new Error('Order not found');

// Fetch items to process
const { data: items } = await supabase
  .from('purchase_order_items')
  .select('*')
  .eq('purchase_order_id', purchase_order_id)
  .in('tpos_sync_status', ['pending', 'failed']) // ← Retry failed items
  .order('position');
```

#### 🔒 Step 2: Lock Check (Race Condition Prevention)
**Lines:** 84-103

```typescript
for (const item of items) {
  // Skip if already processing
  if (item.tpos_sync_status === 'processing') {
    console.log(`Item ${item.product_code} already processing, skip`);
    continue;
  }

  // Atomic lock update
  const { error: updateError } = await supabase
    .from('purchase_order_items')
    .update({ 
      tpos_sync_status: 'processing',
      tpos_sync_started_at: new Date().toISOString()
    })
    .eq('id', item.id)
    .eq('tpos_sync_status', item.tpos_sync_status); // ✅ Atomic check

  if (updateError) {
    console.error(`Failed to lock item ${item.product_code}`);
    continue; // Another process already locked it
  }

  // Process item...
}
```

**Why Atomic?**  
- Nếu 2 functions cùng chạy, chỉ 1 cái update thành công  
- WHERE clause check old status → Prevent duplicate processing  

#### 🏭 Step 3: Call TPOS Function
```typescript
try {
  const { data: tposResult, error: tposError } = await supabase.functions.invoke(
    'create-tpos-variants-from-order',
    {
      body: {
        baseProductCode: item.product_code,
        productName: item.product_name,
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        productImages: item.product_images || [],
        supplierName: order.supplier_name,
        selectedAttributeValueIds: item.selected_attribute_value_ids || []
      }
    }
  );

  if (tposError || !tposResult?.success) {
    throw new Error(tposResult?.error || 'Unknown TPOS error');
  }

  // Continue to Step 4...
} catch (error) {
  // Continue to Step 4 (failed status)...
}
```

#### 💾 Step 4: Update Status
```typescript
// If success
await supabase
  .from('purchase_order_items')
  .update({
    tpos_sync_status: 'success',
    tpos_product_id: tposResult.data?.tpos?.product_id,
    tpos_sync_completed_at: new Date().toISOString(),
    tpos_sync_error: null
  })
  .eq('id', item.id);

results.succeeded++;

// If failed
await supabase
  .from('purchase_order_items')
  .update({
    tpos_sync_status: 'failed',
    tpos_sync_error: error.message, // ← Save error for debugging
    tpos_sync_completed_at: new Date().toISOString()
  })
  .eq('id', item.id);

results.failed++;
results.errors.push({
  item_id: item.id,
  product_code: item.product_code,
  error: error.message
});
```

**Output:**
```json
{
  "success": true,
  "message": "Processed 5/6 items successfully",
  "results": {
    "succeeded": 5,
    "failed": 1,
    "errors": [
      {
        "item_id": "uuid-xxx",
        "product_code": "A01",
        "error": "TPOS API error: 400 - Duplicate product code"
      }
    ]
  }
}
```

---

### Flow 3: Create TPOS Variants (Edge Function)

#### Case 1: Simple Product (No Variants)

```typescript
// Input
const { 
  baseProductCode,    // "A01"
  productName,        // "Áo thun"
  purchasePrice,      // 100
  sellingPrice,       // 200
  productImages,      // ["url1", "url2"]
  supplierName 
} = input;

// Convert image to base64
const imageBase64 = await convertImageToBase64(productImages[0]);

// Build TPOS payload
const payload = {
  Id: 0,
  Name: productName,
  DefaultCode: baseProductCode,
  ListPrice: parsePriceAndMultiply(sellingPrice),    // 200 → 200,000
  PurchasePrice: parsePriceAndMultiply(purchasePrice), // 100 → 100,000
  Image: imageBase64,
  Description: supplierName
};

// POST to TPOS
const response = await fetch(
  'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'Tpos-Agent': 'Node.js v20.5.1',
      'Tpos-Retailer': '1'
    },
    body: JSON.stringify(payload)
  }
);

const tposProduct = await response.json();

// UPSERT to products table
await supabase
  .from('products')
  .upsert({
    product_code: baseProductCode,
    product_name: productName,
    tpos_product_id: tposProduct.Id,
    selling_price: sellingPrice,
    purchase_price: purchasePrice,
    supplier_name: supplierName,
    product_images: productImages
  }, { 
    onConflict: 'product_code',
    ignoreDuplicates: false // Update if exists
  });

// Output
return {
  success: true,
  variant_count: 0,
  data: {
    tpos: { product_id: tposProduct.Id, product_code: baseProductCode },
    database: { parent_saved: 1, children_saved: 0 }
  }
};
```

#### Case 2: Product with Variants

```typescript
// Input includes selectedAttributeValueIds
const selectedAttributeValueIds = [
  "uuid-color-red",
  "uuid-color-blue",
  "uuid-size-s",
  "uuid-size-m"
];

// 1. Fetch attribute values
const { data: attrValues } = await supabase
  .from('product_attribute_values')
  .select('*, product_attributes(*)')
  .in('id', selectedAttributeValueIds);

// 2. Group by attribute
const attributesMap = new Map();
attrValues.forEach(val => {
  const attrId = val.attribute_id;
  if (!attributesMap.has(attrId)) {
    attributesMap.set(attrId, {
      attribute: val.product_attributes,
      values: []
    });
  }
  attributesMap.get(attrId).values.push(val);
});

// 3. Sort by display_order
const attributes = Array.from(attributesMap.values())
  .sort((a, b) => a.attribute.display_order - b.attribute.display_order);

// 4. Generate Cartesian product
// Example: [Red, Blue] x [S, M] = 4 combinations
const combinations = cartesianProduct(
  attributes.map(a => a.values)
);
// Result: [[Red, S], [Red, M], [Blue, S], [Blue, M]]

// 5. Build parent product name
const parentName = `${productName} (${attributes.map(a => 
  a.values.map(v => v.value).join(' | ')
).join(') (')})`;
// "Áo thun (Đỏ | Xanh) (S | M)"

// 6. Build TPOS payload
const payload = {
  Id: 0,
  Name: parentName,
  DefaultCode: baseProductCode,
  ListPrice: parsePriceAndMultiply(sellingPrice),
  PurchasePrice: parsePriceAndMultiply(purchasePrice),
  IsProductVariant: true, // ← Important
  AttributeLines: attributes.map(a => ({
    AttributeId: a.values[0].tpos_attribute_id,
    AttributeValueIds: a.values.map(v => v.tpos_id)
  })),
  ProductVariants: combinations.map((combo, index) => ({
    Id: 0,
    Name: `${productName} (${combo.map(v => v.value).join(', ')})`,
    DefaultCode: `${baseProductCode}-${index + 1}`,
    ListPrice: parsePriceAndMultiply(sellingPrice),
    PurchasePrice: parsePriceAndMultiply(purchasePrice),
    AttributeValueIds: combo.map(v => v.tpos_id)
  }))
};

// 7. POST to TPOS
const response = await fetch(tposUrl, { method: 'POST', ... });
const tposResult = await response.json();

// 8. UPSERT parent to products
await supabase
  .from('products')
  .upsert({
    product_code: baseProductCode,
    product_name: parentName,
    tpos_product_id: tposResult.Id,
    variant: null, // Parent has no variant
    // ... other fields
  }, { onConflict: 'product_code' });

// 9. UPSERT children to products
const childrenToUpsert = tposResult.ProductVariants.map((child, index) => ({
  product_code: `${baseProductCode}-${index + 1}`,
  product_name: child.Name,
  variant: combinations[index].map(v => v.value).join(', '),
  base_product_code: baseProductCode, // ← Link to parent
  tpos_product_id: tposResult.Id,     // Parent ID
  productid_bienthe: child.Id,        // Child ID
  // ... other fields
}));

await supabase
  .from('products')
  .upsert(childrenToUpsert, { onConflict: 'product_code' });

// Output
return {
  success: true,
  variant_count: combinations.length,
  data: {
    tpos: { product_id: tposResult.Id, variant_count: combinations.length },
    database: { parent_saved: 1, children_saved: combinations.length }
  }
};
```

**Price Conversion:**
```typescript
function parsePriceAndMultiply(price: string | number): number {
  const normalized = String(price).replace(',', '.');
  return Math.round(parseFloat(normalized) * 1000);
}

// Examples:
// "100" → 100,000
// "1.5" → 1,500
// 50 → 50,000
```

---

## ✅ Debug Checklist

### 🔴 UI Không Responsive sau khi tạo đơn
- [ ] **Check:** Có `await` ở invoke function không? (Lines 658-671)  
  - ✅ Phải là fire-and-forget: `invoke(...).catch()`  
  - ❌ Không được: `await invoke(...)`  
- [ ] **Check:** Dialog có đóng ngay không?  
  - ✅ `onOpenChange(false)` phải gọi trước khi invoke  
- [ ] **Check:** Polling có start không?  
  - Mở Console → Xem log query sync status  

### 🟡 Items Stuck "Đang xử lý..."
- [ ] **Check:** `tpos_sync_started_at` > 10 phút?  
  ```sql
  SELECT id, product_code, tpos_sync_started_at, tpos_sync_status
  FROM purchase_order_items
  WHERE tpos_sync_status = 'processing'
    AND tpos_sync_started_at < NOW() - INTERVAL '10 minutes';
  ```
- [ ] **Check:** Edge function có crash không?  
  - Supabase Dashboard → Edge Functions → Logs  
  - Tìm error từ `process-purchase-order-background`  
- [ ] **Check:** TPOS token có expire không?  
  ```sql
  SELECT bearer_token, updated_at
  FROM tpos_credentials
  WHERE token_type = 'tpos'
  ORDER BY updated_at DESC
  LIMIT 1;
  ```
  - Token expire → Refresh token trước  

### 🔵 Duplicate Products trên TPOS
- [ ] **Check:** Race condition ở parent product creation?  
  - File: `CreatePurchaseOrderDialog.tsx` (Lines 667-674)  
  - ❌ Code hiện tại: `if (!existingParent) { INSERT }`  
  - ✅ Fix: Dùng `UPSERT` với `onConflict: 'product_code'`  

### 🟢 Badge Không Update
- [ ] **Check:** `PurchaseOrderList.tsx` có `refetchInterval`?  
  - Line 234: Query options  
  - ✅ Thêm: `refetchInterval: 5000`  
- [ ] **Check:** Query có `enabled = true`?  
  - `enabled: filteredOrders.length > 0`  

### 🟣 Memory Leak
- [ ] **Check:** Polling có cleanup khi unmount?  
  - File: `CreatePurchaseOrderDialog.tsx` (Lines 720-792)  
  - ❌ Thiếu: `useEffect(() => { return () => clearInterval(); }, [])`  
  - ✅ Fix: Track intervals trong `useRef` và cleanup  

---

## 📚 Quick Reference

### Status Codes

#### `purchase_orders.status`
| Status | Ý Nghĩa | Khi Nào |
|--------|---------|---------|
| `pending` | Đơn mới tạo, đang xử lý | Sau khi save và invoke background |
| `completed` | Tất cả items đã xử lý xong | Khi all items success/failed |
| `draft` | Nháp, chưa xử lý TPOS | Save draft (không invoke background) |

#### `purchase_order_items.tpos_sync_status`
| Status | Ý Nghĩa | Khi Nào |
|--------|---------|---------|
| `pending` | Chờ xử lý | Initial status sau INSERT |
| `processing` | Đang gọi TPOS API | Edge function đang chạy |
| `success` | Đã tạo thành công trên TPOS | TPOS API return 200, có `tpos_product_id` |
| `failed` | Lỗi | TPOS API error hoặc exception, có `tpos_sync_error` |

### Key Variables

#### Frontend (`CreatePurchaseOrderDialog.tsx`)
```typescript
POLL_INTERVAL = 5000        // 5 giây
MAX_DURATION = 180000       // 3 phút
```

#### Backend (`create-tpos-variants-from-order/index.ts`)
```typescript
TPOS_PRICE_MULTIPLIER = 1000     // Giá x 1000
PROCESSING_TIMEOUT = 10 * 60 * 1000  // 10 phút (⚠️ chưa implement)
```

### Database Quick Queries

#### Xem items đang xử lý
```sql
SELECT 
  po.supplier_name,
  poi.product_code,
  poi.tpos_sync_status,
  poi.tpos_sync_started_at,
  poi.tpos_sync_error
FROM purchase_order_items poi
JOIN purchase_orders po ON poi.purchase_order_id = po.id
WHERE poi.tpos_sync_status = 'processing'
ORDER BY poi.tpos_sync_started_at DESC;
```

#### Xem items lỗi gần đây
```sql
SELECT 
  po.supplier_name,
  poi.product_code,
  poi.tpos_sync_error,
  poi.tpos_sync_completed_at
FROM purchase_order_items poi
JOIN purchase_orders po ON poi.purchase_order_id = po.id
WHERE poi.tpos_sync_status = 'failed'
  AND poi.tpos_sync_completed_at > NOW() - INTERVAL '1 day'
ORDER BY poi.tpos_sync_completed_at DESC
LIMIT 20;
```

#### Reset items bị stuck
```sql
UPDATE purchase_order_items
SET 
  tpos_sync_status = 'pending',
  tpos_sync_started_at = NULL,
  tpos_sync_error = 'Reset: Was stuck in processing'
WHERE tpos_sync_status = 'processing'
  AND tpos_sync_started_at < NOW() - INTERVAL '10 minutes';
```

### TPOS API Quick Reference

#### Endpoint
```
POST https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2
```

#### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
Tpos-Agent: Node.js v20.5.1, Mozilla/5.0, Windows NT 10.0; Win64; x64
Tpos-Retailer: 1
```

#### Response Structure
```json
{
  "Id": 12345,
  "Name": "Product Name",
  "DefaultCode": "CODE",
  "ListPrice": 200000,
  "PurchasePrice": 100000,
  "ProductVariants": [
    {
      "Id": 12346,
      "Name": "Product (Đỏ, S)",
      "DefaultCode": "CODE-1",
      "AttributeValueIds": [1, 3]
    }
  ]
}
```

---

## ⚠️ Top 5 Known Issues

### 🔴 CRITICAL

#### 1. Race Condition - Parent Product Creation
**File:** `CreatePurchaseOrderDialog.tsx` (Lines 667-674)

**Issue:**
```typescript
// ❌ BAD: Check-then-insert
const { data: existingParent } = await supabase
  .from("products")
  .select("id")
  .eq("product_code", item.product_code)
  .single();

if (!existingParent) {
  await supabase.from("products").insert(parentProduct); // Race condition!
}
```

**Fix:**
```typescript
// ✅ GOOD: Atomic UPSERT
await supabase
  .from("products")
  .upsert(parentProduct, { 
    onConflict: 'product_code',
    ignoreDuplicates: false // Update if exists
  });
```

---

#### 2. Items Stuck in Processing Status
**File:** `process-purchase-order-background/index.ts`

**Issue:**
- Edge function crash giữa chừng  
- Items vẫn ở `processing` status  
- Không có timeout mechanism  
- Không thể retry  

**Fix:**
```typescript
// Add at start of function
const PROCESSING_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Reset stuck items
const { data: stuckItems } = await supabase
  .from('purchase_order_items')
  .select('id')
  .eq('tpos_sync_status', 'processing')
  .lt('tpos_sync_started_at', new Date(Date.now() - PROCESSING_TIMEOUT).toISOString());

if (stuckItems?.length > 0) {
  await supabase
    .from('purchase_order_items')
    .update({
      tpos_sync_status: 'pending',
      tpos_sync_started_at: null,
      tpos_sync_error: 'Timeout: Processing took too long'
    })
    .in('id', stuckItems.map(i => i.id));
}
```

---

#### 3. Memory Leak - Polling Intervals
**File:** `CreatePurchaseOrderDialog.tsx` (Lines 720-792)

**Issue:**
- `setInterval` không được clear khi component unmount  
- Multiple intervals chạy song song nếu user mở/đóng dialog nhiều lần  

**Fix:**
```typescript
// Add useRef to track intervals
const activePollingIntervals = useRef<Set<NodeJS.Timeout>>(new Set());

// Cleanup on unmount
useEffect(() => {
  return () => {
    activePollingIntervals.current.forEach(clearInterval);
    activePollingIntervals.current.clear();
  };
}, []);

// In polling function
const pollInterval = setInterval(async () => {
  // ... logic
}, 5000);

activePollingIntervals.current.add(pollInterval);

// When done
const cleanup = () => {
  clearInterval(pollInterval);
  activePollingIntervals.current.delete(pollInterval);
};
```

---

### 🟡 HIGH

#### 4. No Price Validation
**Issue:**
- Cho phép `purchase_price = 0` hoặc `selling_price = 0`  
- Cho phép `selling_price < purchase_price` (bán lỗ)  

**Fix:**
```typescript
// Add validation
const validateItems = () => {
  for (const item of items) {
    if (item.purchase_price <= 0 || item.selling_price <= 0) {
      toast.error(`${item.product_code}: Giá phải > 0`);
      return false;
    }
    
    if (item.selling_price < item.purchase_price) {
      toast.warning(`${item.product_code}: Giá bán < giá mua`);
      // Optional: Ask for confirmation
    }
  }
  return true;
};

// Call before save
if (!validateItems()) return;
```

---

#### 5. Status Badge Not Auto-refreshing
**File:** `PurchaseOrderList.tsx` (Line 234)

**Issue:**
- Badge hiển thị "Đang xử lý..." nhưng không tự động refresh  
- User phải reload page để thấy cập nhật  

**Fix:**
```typescript
const { data: syncStatusMap } = useQuery({
  queryKey: ['order-sync-status', orderIds],
  queryFn: async () => { /* ... */ },
  enabled: orderIds.length > 0,
  refetchInterval: 5000, // ✅ Add this
  staleTime: 2000
});
```

---

## 📖 Đọc Thêm

- **📚 Full Documentation:** [PURCHASE_ORDERS_V1.md](./PURCHASE_ORDERS_V1.md) (3200 dòng, tất cả chi tiết)  
- **📝 Refactor Notes:** `PURCHASE_ORDERS_REFACTOR.md` (Lịch sử thay đổi)  
- **🏠 System Overview:** Settings → Tài Liệu → Tổng quan  

---

**Last Updated:** 2025-10-28  
**Version:** 1.0  
**Maintainer:** Development Team
