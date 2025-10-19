# Purchase Orders Refactor - Complete Decoupling from Products Table

## ✅ COMPLETED
### Database Migration
- ✅ Removed `product_id` column from `purchase_order_items`
- ✅ Renamed all `*_snapshot` columns to primary names  
- ✅ Removed `update_product_stock_on_receiving` trigger

### Code Updates
- ✅ **CreatePurchaseOrderDialog.tsx** - Fully refactored
  - Removed all `product_id` references
  - Changed all `_temp*` fields to direct field names
  - Updated mutation to save directly without product references

## 📋 NEW WORKFLOW
1. **Create/Edit Order** → Save product data directly to `purchase_order_items`
2. **Upload to TPOS** → Get `tpos_product_id` back, save to items *(user implements)*
3. **Fetch from TPOS** → Create/update products in `/products` table *(user implements)*

## 🔑 KEY CHANGES

### Field Name Mapping
- `product_id` → **REMOVED**
- `_tempProductName` / `product_name_snapshot` → `product_name`
- `_tempProductCode` / `product_code_snapshot` → `product_code`
- `_tempVariant` / `variant_snapshot` → `variant`
- `_tempUnitPrice` / `purchase_price_snapshot` → `purchase_price`
- `_tempSellingPrice` / `selling_price_snapshot` → `selling_price`
- `_tempProductImages` / `product_images_snapshot` → `product_images`
- `_tempPriceImages` / `price_images_snapshot` → `price_images`

### Interface Update
```typescript
interface PurchaseOrderItem {
  // ❌ REMOVED: product_id
  quantity: number;
  notes: string;
  
  // ✅ PRIMARY FIELDS (directly saved to DB)
  product_code: string;
  product_name: string;
  variant: string;
  purchase_price: number | string;
  selling_price: number | string;
  product_images: string[];
  price_images: string[];
}
```

### Query Changes
**Before:**
```typescript
.select(`
  *,
  items:purchase_order_items(
    *,
    product:products(...)  // ❌ JOIN removed
  )
`)
```

**After:**
```typescript
.select(`
  *,
  items:purchase_order_items(*)  // ✅ No JOIN
`)
```

## ⚠️ BREAKING CHANGES
- All components must use `item.product_name` instead of `item.product?.product_name`
- Queries no longer JOIN with `products` table
- `hasDeletedProduct` logic removed (no longer relevant)

## 🎯 USER TODO
The following are ready for you to implement:

### 1. Upload to TPOS
In `ExportTPOSDialog.tsx` success handler:
```typescript
// After successful upload to TPOS
await supabase
  .from("purchase_order_items")
  .update({ 
    tpos_product_id: uploadedItem.tpos_product_id 
  })
  .eq("id", item.id);
```

### 2. Fetch from TPOS & Create Products
Create new component/function:
```typescript
async function fetchAndCreateFromTPOS() {
  // 1. Get items with tpos_product_id from purchase_order_items
  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("*")
    .not("tpos_product_id", "is", null);
  
  // 2. Fetch product data from TPOS API
  const tposData = await fetchFromTPOS(items.map(i => i.tpos_product_id));
  
  // 3. Upsert to products table
  await supabase
    .from("products")
    .upsert(tposData.map(p => ({
      product_code: p.code,
      product_name: p.name,
      tpos_product_id: p.id,
      // ... other fields
    })));
}
```

## 📝 NOTES
- Purchase orders are now completely independent of the products table
- Historical data integrity maintained through primary fields
- TPOS sync is unidirectional: Orders → TPOS → Products (never Orders → Products directly)
