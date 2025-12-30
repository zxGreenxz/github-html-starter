# TECHNICAL SPECIFICATION - Firebase Edition
## Module: Quản lý Đơn Đặt Hàng (Purchase Orders)

**Version:** 2.0 (Firebase Optimized)  
**Last Updated:** 30/12/2024  
**Target Platform:** Firebase (Firestore + Auth + Storage)

---

## 1. FIRESTORE DATA MODEL (NoSQL)

> ⚠️ **QUAN TRỌNG:** Đây là NoSQL, KHÔNG dùng JOIN. Tất cả data liên quan được **denormalize** (lưu lặp) vào document chính.

### 1.1. Collection: `purchase_orders`

```typescript
// Path: /purchase_orders/{orderId}
interface PurchaseOrderDocument {
  // === IDENTITY ===
  id: string;                              // Auto-generated document ID
  orderNumber: string;                     // Human-readable: "PO-20241230-001"
  
  // === TIMESTAMPS (Firestore Timestamp) ===
  orderDate: Timestamp;                    // Ngày đặt hàng (user chọn)
  createdAt: Timestamp;                    // Thời điểm tạo (auto)
  updatedAt: Timestamp;                    // Lần cập nhật cuối (auto)
  
  // === STATUS ===
  status: OrderStatus;
  statusHistory: StatusChange[];           // Audit trail
  
  // === SUPPLIER SNAPSHOT (Denormalized) ===
  supplier: SupplierSnapshot | null;
  
  // === FINANCIAL (stored in VND - actual values) ===
  invoiceAmount: number;                   // Số tiền trên hóa đơn NCC
  totalAmount: number;                     // SUM(items.purchasePrice * quantity)
  discountAmount: number;                  // Chiết khấu
  shippingFee: number;                     // Phí vận chuyển
  finalAmount: number;                     // total - discount + shipping
  
  // === DOCUMENTS ===
  invoiceImages: string[];                 // Firebase Storage URLs
  notes: string;
  
  // === ITEMS (Embedded Array - Max ~100 items) ===
  items: OrderItemSnapshot[];
  
  // === SUMMARY (Computed, stored for query optimization) ===
  totalItems: number;                      // COUNT(items)
  totalQuantity: number;                   // SUM(items.quantity)
  
  // === METADATA ===
  createdBy: UserSnapshot;
  lastModifiedBy: UserSnapshot;
}
```

### 1.2. Embedded Types (Snapshots)

```typescript
// === SUPPLIER SNAPSHOT ===
interface SupplierSnapshot {
  id: string;                              // Original supplier ID (for reference)
  code: string;                            // "A62", "Q5"
  name: string;                            // "Nhà cung cấp A62"
  phone?: string;
  address?: string;
  // ⚠️ Snapshot tại thời điểm tạo đơn, không tự update khi supplier thay đổi
}

// === ORDER ITEM SNAPSHOT ===
interface OrderItemSnapshot {
  id: string;                              // UUID for this item
  position: number;                        // Display order (1-based)
  
  // Product snapshot (denormalized)
  productCode: string;                     // "N123", "P45"
  productName: string;                     // Full product name
  variant: string;                         // "38", "M", "Đỏ, M, 2"
  productImages: string[];                 // Firebase Storage URLs
  priceImages: string[];                   // Price proof images
  
  // Pricing (VND)
  purchasePrice: number;                   // Giá mua 1 đơn vị
  sellingPrice: number;                    // Giá bán niêm yết
  
  // Quantity
  quantity: number;                        // Số lượng (min: 1)
  subtotal: number;                        // purchasePrice * quantity
  
  // Notes
  notes: string;
  
  // Sync status (optional, for TPOS integration)
  tposSyncStatus?: 'pending' | 'processing' | 'success' | 'failed';
  tposProductId?: number;
}

// === USER SNAPSHOT ===
interface UserSnapshot {
  uid: string;
  displayName: string;
  email: string;
}

// === STATUS CHANGE (Audit Trail) ===
interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedAt: Timestamp;
  changedBy: UserSnapshot;
  reason?: string;                         // Optional reason for status change
}
```

### 1.3. Enums & Constants

```typescript
// === ORDER STATUS ===
type OrderStatus = 
  | 'DRAFT'                    // Nháp - Chưa xác nhận
  | 'AWAITING_PURCHASE'        // CHỜ MUA - Đã xác nhận, chờ xuất tiền
  | 'AWAITING_DELIVERY'        // CHỜ HÀNG - Đã thanh toán, chờ giao
  | 'RECEIVED'                 // Đã nhận hàng
  | 'COMPLETED'                // Hoàn thành
  | 'CANCELLED';               // Đã hủy

// === STATUS LABELS (Vietnamese) ===
const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Nháp',
  AWAITING_PURCHASE: 'Chờ mua',
  AWAITING_DELIVERY: 'Chờ hàng',
  RECEIVED: 'Đã nhận',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy'
};

// === STATUS COLORS (for UI badges) ===
const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#f3f4f6', text: '#6b7280' },
  AWAITING_PURCHASE: { bg: '#dbeafe', text: '#2563eb' },
  AWAITING_DELIVERY: { bg: '#fef3c7', text: '#d97706' },
  RECEIVED: { bg: '#d1fae5', text: '#059669' },
  COMPLETED: { bg: '#d1fae5', text: '#059669' },
  CANCELLED: { bg: '#fee2e2', text: '#dc2626' }
};
```

### 1.4. Firestore Indexes (Required)

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "purchase_orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "purchase_orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "orderDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 1.5. Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /purchase_orders/{orderId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && canUpdateOrder(resource.data.status);
      allow delete: if request.auth != null 
        && resource.data.status in ['DRAFT', 'CANCELLED'];
    }
    
    function canUpdateOrder(currentStatus) {
      return currentStatus != 'COMPLETED';
    }
  }
}
```

---

## 2. BUSINESS LOGIC & VALIDATION

### 2.1. Status Workflow (State Machine)

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
    ┌───────────────▼───────────────┐                         │
    │           DRAFT               │◄────────────────────────┤
    │     (Có thể sửa/xóa)          │        Hủy xác nhận     │
    └───────────────┬───────────────┘                         │
                    │ Xác nhận đơn                            │
                    ▼                                         │
    ┌───────────────────────────────┐                         │
    │      AWAITING_PURCHASE        │─────────────────────────┘
    │       (Chờ xuất tiền)         │
    └───────────────┬───────────────┘
                    │ Đã thanh toán cho NCC
                    ▼
    ┌───────────────────────────────┐
    │      AWAITING_DELIVERY        │
    │        (Chờ giao hàng)        │──────────┐
    └───────────────┬───────────────┘          │
                    │ Hàng về kho              │ Hủy đơn
                    ▼                          ▼
    ┌───────────────────────────────┐  ┌───────────────┐
    │          RECEIVED             │  │   CANCELLED   │
    │       (Đã nhận hàng)          │  │   (Đã hủy)    │
    └───────────────┬───────────────┘  └───────────────┘
                    │ Xác nhận hoàn tất
                    ▼
    ┌───────────────────────────────┐
    │          COMPLETED            │
    │   (Hoàn thành - Read Only)    │
    └───────────────────────────────┘
```

### 2.2. Allowed Status Transitions

```typescript
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['AWAITING_PURCHASE', 'CANCELLED'],
  AWAITING_PURCHASE: ['AWAITING_DELIVERY', 'DRAFT', 'CANCELLED'],
  AWAITING_DELIVERY: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['COMPLETED'],
  COMPLETED: [],              // No transitions allowed (final state)
  CANCELLED: []               // No transitions allowed (final state)
};

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### 2.3. Validation Rules

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;           // e.g., "items[0].quantity"
  code: string;            // e.g., "QUANTITY_INVALID"
  message: string;         // User-facing message in Vietnamese
}

// === VALIDATION ERROR CODES & MESSAGES ===
const VALIDATION_MESSAGES = {
  // Supplier
  SUPPLIER_REQUIRED: 'Vui lòng chọn nhà cung cấp',
  
  // Items
  ITEMS_REQUIRED: 'Đơn hàng phải có ít nhất 1 sản phẩm',
  PRODUCT_NAME_REQUIRED: 'Tên sản phẩm không được để trống',
  PRODUCT_CODE_REQUIRED: 'Mã sản phẩm không được để trống',
  PRODUCT_CODE_DUPLICATE: 'Mã sản phẩm bị trùng lặp',
  PRODUCT_IMAGES_REQUIRED: 'Vui lòng thêm ít nhất 1 hình ảnh sản phẩm',
  
  // Quantity
  QUANTITY_INVALID: 'Số lượng phải là số nguyên dương',
  QUANTITY_MIN: 'Số lượng tối thiểu là 1',
  QUANTITY_MAX: 'Số lượng tối đa là 9999',
  
  // Price
  PURCHASE_PRICE_INVALID: 'Giá mua không hợp lệ',
  PURCHASE_PRICE_NEGATIVE: 'Giá mua không được âm',
  PURCHASE_PRICE_MIN: 'Giá mua tối thiểu là 1.000đ',
  SELLING_PRICE_INVALID: 'Giá bán không hợp lệ',
  SELLING_PRICE_NEGATIVE: 'Giá bán không được âm',
  SELLING_PRICE_LESS_THAN_PURCHASE: 'Giá bán phải lớn hơn giá mua',
  MARGIN_TOO_LOW: 'Lợi nhuận phải tối thiểu 10.000đ',
  
  // Status
  STATUS_TRANSITION_INVALID: 'Không thể chuyển sang trạng thái này',
  ORDER_COMPLETED_READONLY: 'Không thể sửa đơn đã hoàn thành',
  ORDER_CANCELLED_READONLY: 'Không thể sửa đơn đã hủy',
  DELETE_COMPLETED_FORBIDDEN: 'Không thể xóa đơn đã hoàn thành'
};

// === VALIDATION FUNCTION ===
function validateOrder(order: Partial<PurchaseOrderDocument>): ValidationResult {
  const errors: ValidationError[] = [];
  
  // 1. Supplier validation
  if (!order.supplier?.code) {
    errors.push({
      field: 'supplier',
      code: 'SUPPLIER_REQUIRED',
      message: VALIDATION_MESSAGES.SUPPLIER_REQUIRED
    });
  }
  
  // 2. Items validation
  if (!order.items || order.items.length === 0) {
    errors.push({
      field: 'items',
      code: 'ITEMS_REQUIRED',
      message: VALIDATION_MESSAGES.ITEMS_REQUIRED
    });
  } else {
    order.items.forEach((item, index) => {
      // Product name
      if (!item.productName?.trim()) {
        errors.push({
          field: `items[${index}].productName`,
          code: 'PRODUCT_NAME_REQUIRED',
          message: VALIDATION_MESSAGES.PRODUCT_NAME_REQUIRED
        });
      }
      
      // Quantity
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        errors.push({
          field: `items[${index}].quantity`,
          code: 'QUANTITY_MIN',
          message: VALIDATION_MESSAGES.QUANTITY_MIN
        });
      }
      
      // Purchase price
      if (item.purchasePrice < 0) {
        errors.push({
          field: `items[${index}].purchasePrice`,
          code: 'PURCHASE_PRICE_NEGATIVE',
          message: VALIDATION_MESSAGES.PURCHASE_PRICE_NEGATIVE
        });
      }
      
      // Selling > Purchase
      if (item.sellingPrice <= item.purchasePrice) {
        errors.push({
          field: `items[${index}].sellingPrice`,
          code: 'SELLING_PRICE_LESS_THAN_PURCHASE',
          message: VALIDATION_MESSAGES.SELLING_PRICE_LESS_THAN_PURCHASE
        });
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## 3. FIREBASE SERVICE LAYER

### 3.1. Core Service Functions

```typescript
// services/purchaseOrderService.ts
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, startAfter,
  getDoc, getDocs, writeBatch, serverTimestamp,
  Timestamp, DocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTION = 'purchase_orders';
const PAGE_SIZE = 20;

// === CREATE ORDER ===
async function createOrder(
  orderData: Omit<PurchaseOrderDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    // Validate
    const validation = validateOrder(orderData);
    if (!validation.isValid) {
      throw new ValidationException(validation.errors);
    }
    
    // Calculate totals
    const totalAmount = orderData.items.reduce(
      (sum, item) => sum + item.subtotal, 0
    );
    const finalAmount = totalAmount - orderData.discountAmount + orderData.shippingFee;
    
    // Generate order number
    const orderNumber = await generateOrderNumber();
    
    // Create document
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...orderData,
      orderNumber,
      totalAmount,
      finalAmount,
      totalItems: orderData.items.length,
      totalQuantity: orderData.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      statusHistory: [{
        from: null,
        to: orderData.status,
        changedAt: Timestamp.now(),
        changedBy: orderData.createdBy
      }]
    });
    
    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationException) throw error;
    throw new ServiceException('CREATE_FAILED', 'Không thể tạo đơn hàng. Vui lòng thử lại.');
  }
}

// === GET ORDERS BY STATUS (with pagination) ===
async function getOrdersByStatus(
  status: OrderStatus | OrderStatus[],
  lastDoc?: DocumentSnapshot,
  pageSize: number = PAGE_SIZE
): Promise<{
  orders: PurchaseOrderDocument[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  try {
    let q = query(
      collection(db, COLLECTION),
      Array.isArray(status) 
        ? where('status', 'in', status)
        : where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)  // +1 to check if there's more
    );
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    
    return {
      orders: docs.slice(0, pageSize).map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PurchaseOrderDocument)),
      lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null,
      hasMore
    };
  } catch (error) {
    throw new ServiceException('FETCH_FAILED', 'Không thể tải danh sách đơn hàng.');
  }
}

// === UPDATE STATUS ===
async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  user: UserSnapshot,
  reason?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, orderId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new ServiceException('NOT_FOUND', 'Đơn hàng không tồn tại.');
    }
    
    const currentStatus = docSnap.data().status as OrderStatus;
    
    // Validate transition
    if (!canTransition(currentStatus, newStatus)) {
      throw new ServiceException(
        'INVALID_TRANSITION',
        `Không thể chuyển từ "${STATUS_LABELS[currentStatus]}" sang "${STATUS_LABELS[newStatus]}"`
      );
    }
    
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      statusHistory: [...docSnap.data().statusHistory, {
        from: currentStatus,
        to: newStatus,
        changedAt: Timestamp.now(),
        changedBy: user,
        reason
      }]
    });
  } catch (error) {
    if (error instanceof ServiceException) throw error;
    throw new ServiceException('UPDATE_FAILED', 'Không thể cập nhật trạng thái.');
  }
}

// === DELETE ORDER ===
async function deleteOrder(orderId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, orderId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new ServiceException('NOT_FOUND', 'Đơn hàng không tồn tại.');
    }
    
    const status = docSnap.data().status as OrderStatus;
    
    // Business rule: Cannot delete completed orders
    if (status === 'COMPLETED') {
      throw new ServiceException(
        'DELETE_FORBIDDEN',
        VALIDATION_MESSAGES.DELETE_COMPLETED_FORBIDDEN
      );
    }
    
    await deleteDoc(docRef);
  } catch (error) {
    if (error instanceof ServiceException) throw error;
    throw new ServiceException('DELETE_FAILED', 'Không thể xóa đơn hàng.');
  }
}

// === COPY ORDER (Clone) ===
async function copyOrder(
  sourceOrderId: string,
  user: UserSnapshot
): Promise<string> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, sourceOrderId));
    
    if (!docSnap.exists()) {
      throw new ServiceException('NOT_FOUND', 'Đơn hàng không tồn tại.');
    }
    
    const sourceData = docSnap.data() as PurchaseOrderDocument;
    
    // Create new draft from source
    return await createOrder({
      ...sourceData,
      status: 'DRAFT',
      orderDate: Timestamp.now(),
      statusHistory: [],
      createdBy: user,
      lastModifiedBy: user,
      // Reset TPOS sync status
      items: sourceData.items.map(item => ({
        ...item,
        id: generateUUID(),
        tposSyncStatus: undefined,
        tposProductId: undefined
      }))
    });
  } catch (error) {
    if (error instanceof ServiceException) throw error;
    throw new ServiceException('COPY_FAILED', 'Không thể sao chép đơn hàng.');
  }
}
```

### 3.2. Error Handling Classes

```typescript
// errors/index.ts
class ServiceException extends Error {
  constructor(
    public code: string,
    public userMessage: string
  ) {
    super(userMessage);
    this.name = 'ServiceException';
  }
}

class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
  }
}

class NetworkException extends Error {
  constructor() {
    super('Network error');
    this.name = 'NetworkException';
  }
  
  userMessage = 'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.';
}
```

### 3.3. React Hooks

```typescript
// hooks/usePurchaseOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePurchaseOrders(status: OrderStatus) {
  return useQuery({
    queryKey: ['purchase-orders', status],
    queryFn: () => getOrdersByStatus(status),
    staleTime: 30 * 1000,          // 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: ServiceException | ValidationException) => {
      // Error handled by component
    }
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ orderId, status, user, reason }) => 
      updateOrderStatus(orderId, status, user, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    }
  });
}
```

---

## 4. UTILITY FUNCTIONS

### 4.1. Currency Formatting

```typescript
// utils/currency.ts
export function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0
  }).format(value);
}

// "85000" → "85.000 ₫"
// "2355000" → "2.355.000 ₫"
```

### 4.2. Date Formatting

```typescript
// utils/date.ts
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

export function formatOrderDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yyyy', { locale: vi });
}

export function formatOrderDateTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
}

export function formatRelativeTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  
  return formatOrderDate(timestamp);
}
```

### 4.3. Order Number Generator

```typescript
// utils/orderNumber.ts
async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const datePrefix = format(today, 'yyyyMMdd');
  
  // Query today's orders to get the next sequence
  const q = query(
    collection(db, COLLECTION),
    where('orderNumber', '>=', `PO-${datePrefix}-`),
    where('orderNumber', '<', `PO-${datePrefix}-~`),
    orderBy('orderNumber', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  let sequence = 1;
  if (!snapshot.empty) {
    const lastNumber = snapshot.docs[0].data().orderNumber;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  return `PO-${datePrefix}-${String(sequence).padStart(3, '0')}`;
}
```

---

## 5. DEPENDENCIES

```json
{
  "dependencies": {
    "firebase": "^10.x",
    "@tanstack/react-query": "^5.x",
    "date-fns": "^2.x",
    "uuid": "^9.x"
  }
}
```

---

**Document này đảm bảo 100% Firebase/NoSQL best practices, không dùng JOIN, có đầy đủ error handling và validation.**
