# AI AGENT PROMPT: Xây dựng Module Quản lý Đơn Đặt Hàng

## 🎯 NHIỆM VỤ

Bạn là **Senior Full-Stack Developer**. Hãy xây dựng **module Quản lý Đơn Đặt Hàng (Purchase Orders)** cho hệ thống quản lý bán hàng.

---

## 📋 TÀI LIỆU ĐẦU VÀO

Tôi cung cấp 2 tài liệu đính kèm:

| File | Nội dung |
|------|----------|
| `TECH_SPEC_Firebase.md` | Data model, TypeScript interfaces, validation, service layer |
| `UI_SPEC_Firebase.md` | Giao diện, states, responsive, accessibility |

**⚠️ ĐỌC KỸ CẢ 2 FILE TRƯỚC KHI CODE.**

---

## 🛠️ TECH STACK BẮT BUỘC

```
Frontend:     React 18+ / TypeScript / TailwindCSS
Database:     Firebase Firestore
Auth:         Firebase Auth
Storage:      Firebase Storage (cho images)
UI:           shadcn/ui components
Icons:        Lucide React
State:        TanStack Query (React Query)
```

---

## 📂 CẤU TRÚC THƯ MỤC

```
src/
├── features/
│   └── purchase-orders/
│       ├── components/
│       │   ├── PurchaseOrderList.tsx
│       │   ├── PurchaseOrderTable.tsx
│       │   ├── PurchaseOrderForm.tsx
│       │   ├── SummaryCards.tsx
│       │   ├── FilterBar.tsx
│       │   └── StatusBadge.tsx
│       ├── hooks/
│       │   ├── usePurchaseOrders.ts
│       │   ├── useCreateOrder.ts
│       │   └── useOrderStats.ts
│       ├── services/
│       │   └── purchaseOrderService.ts
│       ├── types/
│       │   └── index.ts
│       └── constants/
│           └── index.ts
├── lib/
│   └── firebase.ts
└── pages/
    └── PurchaseOrdersPage.tsx
```

---

## 🔧 QUY TRÌNH THỰC HIỆN

### BƯỚC 1: Setup Firebase
```typescript
// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Initialize Firebase với config từ env
```

### BƯỚC 2: Tạo Types (theo TECH_SPEC)
- Copy interfaces: `PurchaseOrderDocument`, `OrderItemSnapshot`, `SupplierSnapshot`
- Copy enums: `OrderStatus`, `STATUS_LABELS`, `STATUS_COLORS`
- Export validation messages

### BƯỚC 3: Tạo Service Layer (theo TECH_SPEC)
Implement các functions:
- `createOrder()` - Tạo đơn mới
- `getOrdersByStatus()` - Query với pagination
- `updateOrderStatus()` - Đổi trạng thái
- `deleteOrder()` - Xóa đơn (có validation)
- `copyOrder()` - Clone đơn

### BƯỚC 4: Tạo React Hooks
```typescript
// usePurchaseOrders.ts
export function usePurchaseOrders(status: OrderStatus) {
  return useQuery({
    queryKey: ['purchase-orders', status],
    queryFn: () => getOrdersByStatus(status)
  });
}
```

### BƯỚC 5: Tạo UI Components (theo UI_SPEC)

| Component | Lưu ý quan trọng |
|-----------|------------------|
| `PurchaseOrderTable` | Implement Row Spanning cho đơn có nhiều SP |
| `PurchaseOrderForm` | Inline validation errors |
| `SummaryCards` | Skeleton loading state |
| `FilterBar` | Debounce search 300ms |
| `StatusBadge` | Map colors từ `STATUS_COLORS` |

### BƯỚC 6: Xử lý States (theo UI_SPEC)
Mỗi component phải có:
- ✅ Loading state (skeleton/spinner)
- ✅ Empty state (CTA button)
- ✅ Error state (retry button)
- ✅ Success state

---

## ✅ CHECKLIST HOÀN THÀNH

Sau khi code xong, hãy verify:

- [ ] Firestore collections được tạo đúng structure
- [ ] CRUD operations hoạt động
- [ ] Status transitions đúng workflow
- [ ] Validation hiển thị lỗi tiếng Việt
- [ ] Loading/Empty/Error states hoạt động
- [ ] Row spanning trong table hiển thị đúng
- [ ] Responsive trên mobile
- [ ] Pagination theo cursor (startAfter)

---

## 🚫 KHÔNG LÀM

- ❌ Không dùng SQL JOIN
- ❌ Không dùng realtime listeners (chỉ manual refresh)
- ❌ Không hardcode strings (dùng constants)
- ❌ Không bỏ qua error handling

---

## 🎉 OUTPUT

Sau khi hoàn thành, cung cấp:
1. Danh sách files đã tạo
2. Hướng dẫn setup Firebase project
3. Screenshot/demo các states

---

**BẮT ĐẦU TỪ BƯỚC 1 → 6. HỎI NẾU CẦN CLARIFY.**
