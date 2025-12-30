# AI AGENT PROMPTS: Xây dựng Module Quản lý Đơn Đặt Hàng

> ⚠️ **LƯU Ý QUAN TRỌNG:** Do giới hạn token, hãy thực hiện **TỪNG PHASE** một. Sau mỗi phase, báo cáo kết quả trước khi tiếp tục phase tiếp theo.

---

## 📂 TÀI LIỆU THAM KHẢO

| File | URL | Nội dung |
|------|-----|----------|
| TECH_SPEC | `docs/TECH_SPEC_Firebase.md` | Data model, TypeScript, validation, service layer |
| UI_SPEC | `PRD_Purchase_Orders_Page.md` | Giao diện, colors, components, screenshots |

**Screenshots có trong PRD:**
- Demo recording: `docs/images/demo_recording.webp`
- Main page: `docs/images/screenshot_main.png`
- Dropdown filter: `docs/images/screenshot_dropdown.png`

---

# PHASE 1: FIREBASE SETUP & TYPES

## Prompt Phase 1:
```
Đọc file TECH_SPEC_Firebase.md (Section 1: Firestore Data Model).

Nhiệm vụ:
1. Tạo file `src/lib/firebase.ts` - Firebase config initialization
2. Tạo file `src/features/purchase-orders/types/index.ts` với:
   - Interface: PurchaseOrderDocument
   - Interface: OrderItemSnapshot
   - Interface: SupplierSnapshot
   - Interface: UserSnapshot
   - Interface: StatusChange
   - Type: OrderStatus
   - Constants: STATUS_LABELS, STATUS_COLORS
   - Constants: ALLOWED_TRANSITIONS

Output: 2 files TypeScript hoàn chỉnh, sẵn sàng sử dụng.
```

---

# PHASE 2: VALIDATION & ERROR HANDLING

## Prompt Phase 2:
```
Đọc file TECH_SPEC_Firebase.md (Section 2: Business Logic & Validation).

Nhiệm vụ:
1. Tạo file `src/features/purchase-orders/utils/validation.ts`:
   - Interface: ValidationResult, ValidationError
   - Constant: VALIDATION_MESSAGES (20+ messages tiếng Việt)
   - Function: validateOrder(order) → ValidationResult
   - Function: canTransition(from, to) → boolean

2. Tạo file `src/features/purchase-orders/errors/index.ts`:
   - Class: ServiceException
   - Class: ValidationException
   - Class: NetworkException

Output: 2 files TypeScript với đầy đủ error handling.
```

---

# PHASE 3: FIREBASE SERVICE LAYER

## Prompt Phase 3:
```
Đọc file TECH_SPEC_Firebase.md (Section 3: Firebase Service Layer).

Nhiệm vụ:
1. Tạo file `src/features/purchase-orders/services/purchaseOrderService.ts`:
   - Function: createOrder(orderData) → Promise<string>
   - Function: getOrdersByStatus(status, lastDoc?, pageSize?) → Promise<{orders, lastDoc, hasMore}>
   - Function: updateOrderStatus(orderId, newStatus, user, reason?) → Promise<void>
   - Function: deleteOrder(orderId) → Promise<void>
   - Function: copyOrder(sourceOrderId, user) → Promise<string>

2. Sử dụng Firebase SDK v9 (modular imports)
3. Implement try/catch với ServiceException

Output: 1 file service hoàn chỉnh với CRUD operations.
```

---

# PHASE 4: REACT HOOKS

## Prompt Phase 4:
```
Nhiệm vụ:
1. Tạo file `src/features/purchase-orders/hooks/usePurchaseOrders.ts`:
   - Hook: usePurchaseOrders(status) - Query orders by status
   - Hook: useOrderStats() - Get summary statistics

2. Tạo file `src/features/purchase-orders/hooks/useOrderMutations.ts`:
   - Hook: useCreateOrder() - Mutation to create
   - Hook: useUpdateOrderStatus() - Mutation to update status
   - Hook: useDeleteOrder() - Mutation to delete
   - Hook: useCopyOrder() - Mutation to copy

3. Sử dụng @tanstack/react-query
4. Implement invalidateQueries sau mỗi mutation

Output: 2 files hooks sẵn sàng sử dụng trong components.
```

---

# PHASE 5: UI COMPONENTS - BASIC

## Prompt Phase 5:
```
Đọc file PRD_Purchase_Orders_Page.md (Section 2: UI & Visual, Section 3: Components).

Nhiệm vụ tạo các components cơ bản:

1. `src/features/purchase-orders/components/StatusBadge.tsx`
   - Props: status: OrderStatus
   - Render badge với màu từ STATUS_COLORS

2. `src/features/purchase-orders/components/SummaryCards.tsx`
   - 5 cards: Tổng đơn, Tổng giá trị, Đơn hôm nay, Giá trị hôm nay, Đồng bộ TPOS
   - Loading state với skeleton
   - Dùng Lucide icons

3. `src/features/purchase-orders/components/FilterBar.tsx`
   - Date range picker (từ ngày, đến ngày)
   - Quick filter dropdown
   - Search input với debounce 300ms
   - Status filter

Output: 3 files components với styling TailwindCSS.
```

---

# PHASE 6: UI COMPONENTS - TABLE (COMPLEX)

## Prompt Phase 6:
```
Đọc file PRD_Purchase_Orders_Page.md (Section 3E: Main Table - Row Spanning).

⚠️ ĐÂY LÀ COMPONENT PHỨC TẠP NHẤT!

Nhiệm vụ:
1. `src/features/purchase-orders/components/PurchaseOrderTable.tsx`
   - 12 columns như trong PRD
   - Implement ROW SPANNING cho: Ngày đặt, NCC, Hóa đơn, Ghi chú, Trạng thái, Thao tác
   - Mỗi đơn hàng có nhiều items → rowSpan = items.length
   - Loading state với skeleton rows
   - Empty state với CTA
   - Error state với retry button

2. Action buttons per row:
   - Edit (disabled khi COMPLETED/CANCELLED)
   - Download Excel
   - Copy
   - Delete (disabled khi COMPLETED)
   - Checkbox

Output: 1 file table component với row spanning logic.
```

---

# PHASE 7: UI COMPONENTS - FORM MODAL

## Prompt Phase 7:
```
Đọc file PRD_Purchase_Orders_Page.md (Section về Form).

Nhiệm vụ:
1. `src/features/purchase-orders/components/PurchaseOrderForm.tsx`
   - Form fields: NCC (select), Ngày đặt, Ghi chú, Hình ảnh hóa đơn
   - Items table: Tên SP, Mã SP, SL, Giá mua, Giá bán, Xóa
   - Add/Remove items
   - Tính tổng tiền, chiết khấu, phí ship, thành tiền

2. Inline validation errors cho mỗi field
3. Form error summary khi submit
4. Loading state cho button lưu
5. Buttons: Hủy, Lưu nháp, Xác nhận

Output: 1 file form component với full validation UI.
```

---

# PHASE 8: MAIN PAGE & INTEGRATION

## Prompt Phase 8:
```
Nhiệm vụ:
1. `src/pages/PurchaseOrdersPage.tsx`
   - Layout: Header + SummaryCards + Tabs + FilterBar + Table + Pagination
   - 3 Tabs: Nháp (DRAFT), Chờ mua (AWAITING_PURCHASE), Chờ hàng (AWAITING_DELIVERY)
   - Modal cho Create/Edit form
   - Confirmation dialogs cho Delete/Status change

2. Integrate tất cả components và hooks
3. Handle routing và state

Output: 1 file main page hoàn chỉnh.
```

---

# PHASE 9: FIRESTORE SETUP & TESTING

## Prompt Phase 9:
```
Nhiệm vụ:
1. Tạo file `firestore.rules` - Security rules
2. Tạo file `firestore.indexes.json` - Required indexes
3. Tạo sample data script để test

Output:
- Firebase configuration files
- Hướng dẫn deploy lên Firebase project
- Checklist test cases
```

---

## 📋 TỔNG KẾT CẤU TRÚC FILES

```
src/
├── lib/
│   └── firebase.ts                    # Phase 1
├── features/purchase-orders/
│   ├── types/
│   │   └── index.ts                   # Phase 1
│   ├── utils/
│   │   └── validation.ts              # Phase 2
│   ├── errors/
│   │   └── index.ts                   # Phase 2
│   ├── services/
│   │   └── purchaseOrderService.ts    # Phase 3
│   ├── hooks/
│   │   ├── usePurchaseOrders.ts       # Phase 4
│   │   └── useOrderMutations.ts       # Phase 4
│   └── components/
│       ├── StatusBadge.tsx            # Phase 5
│       ├── SummaryCards.tsx           # Phase 5
│       ├── FilterBar.tsx              # Phase 5
│       ├── PurchaseOrderTable.tsx     # Phase 6
│       └── PurchaseOrderForm.tsx      # Phase 7
└── pages/
    └── PurchaseOrdersPage.tsx         # Phase 8
```

---

## 🚀 CÁCH SỬ DỤNG

1. Copy prompt của **Phase 1** → Gửi cho AI agent
2. Đợi AI hoàn thành → Review code
3. Copy prompt của **Phase 2** → Gửi tiếp
4. Lặp lại đến Phase 9

**Mỗi phase độc lập, có thể dừng và tiếp tục sau.**
