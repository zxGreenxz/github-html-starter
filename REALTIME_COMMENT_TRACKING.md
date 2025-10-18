# Realtime Comment Tracking System

## Overview
Hệ thống theo dõi realtime comments với logic nhớ số lượng comments bị TPOS xóa để so sánh chính xác.

## Logic Tracking

### Variables
```typescript
lastKnownCountRef.current    // Số lượng comment TPOS lần check cuối
deletedCountRef.current      // Tổng số comment bị TPOS xóa
currentDbCount               // Số comment trong DB hiện tại
tposCount                    // Số comment TPOS hiện tại
```

### Công thức tính
```
expectedDbCount = tposCount + deletedCountRef.current
```

## Flow Chart

```
┌─────────────────────────────────────────────────┐
│ Live Session (statusLive = 1)                   │
│ Check mỗi 10 giây                               │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 1. Count DB & TPOS                              │
│    - currentDbCount (từ DB)                     │
│    - tposCount (từ selectedVideo.countComment)  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. Check TPOS xóa comment?                      │
│    if (tposCount < lastKnownCountRef)           │
│       deletedThisTime = last - current          │
│       deletedCountRef += deletedThisTime        │
│       Toast: "TPOS đã xóa X comment"            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. Tính expectedDbCount                         │
│    expectedDbCount = tposCount + deletedCount   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 4. So sánh với DB                               │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
┌──────────────┐  ┌──────────────┐
│ DB < Expected│  │ DB = Expected│
│ Fetch new    │  │ In sync ✅   │
│ comments     │  └──────────────┘
│ Toast: "Có   │
│ X comment    │
│ mới"         │
└──────────────┘
```

## Example Scenarios

### Scenario 1: Comment mới (không có xóa)
```
Initial:
- lastKnown = 100
- deleted = 0
- DB = 100
- TPOS = 100

After 10s (có 5 comment mới):
- TPOS = 105
- deleted = 0
- expected = 105 + 0 = 105
- DB = 100
- DB < expected → Fetch 5 comments mới ✅
```

### Scenario 2: TPOS xóa 3 comments
```
Before:
- lastKnown = 100
- deleted = 0
- DB = 100
- TPOS = 100

After TPOS xóa:
- TPOS = 97
- TPOS < lastKnown → deleted += 3
- deleted = 3
- expected = 97 + 3 = 100
- DB = 100
- DB = expected → In sync ✅
- Toast: "TPOS đã xóa 3 comment"
```

### Scenario 3: TPOS xóa 3, sau đó có 5 comment mới
```
Step 1: TPOS xóa
- TPOS = 97
- deleted = 3
- expected = 100
- DB = 100 → In sync ✅

Step 2: Có 5 comment mới
- TPOS = 102
- deleted = 3
- expected = 102 + 3 = 105
- DB = 100
- DB < expected → Fetch 5 comments mới ✅
- After fetch: DB = 105 = expected ✅
```

### Scenario 4: TPOS xóa nhiều lần
```
Lần 1: TPOS xóa 2
- deleted = 2

Lần 2: TPOS xóa thêm 3
- deleted = 2 + 3 = 5

Lần 3: Có 10 comment mới
- TPOS = 105 (từ 95)
- deleted = 5
- expected = 105 + 5 = 110
- DB = 100
- Fetch 10 comments → DB = 110 ✅
```

## Reset Logic

Khi chọn video mới:
```typescript
lastKnownCountRef.current = video.countComment || 0;
deletedCountRef.current = 0; // Reset về 0
```

Mỗi video có counter riêng, không bị ảnh hưởng bởi video khác.

## Benefits

✅ **Chính xác**: So sánh đúng ngay cả khi TPOS xóa comments
✅ **Không mất data**: Comments xóa vẫn giữ trong DB
✅ **Realtime**: Detect comment mới và xóa trong 10s
✅ **Toast thông báo**: User biết khi có comment mới hoặc bị xóa
✅ **Performance**: Chỉ fetch comments thực sự mới

## Console Logs

Mỗi lần check sẽ log:
```
[Realtime Check] Video: <videoId>
  DB: 100, TPOS: 105, Deleted: 3, Last TPOS: 100
  Expected DB count: 105 + 3 = 108
  DB in sync: 100 = 100 ✅
```

hoặc

```
[Realtime Check] Video: <videoId>
  DB: 100, TPOS: 105, Deleted: 0, Last TPOS: 100
  Expected DB count: 105 + 0 = 105
  Fetching 5 new comments
```

## Files Modified

1. `src/hooks/use-facebook-comments.ts` - Tracking logic in hook
2. `src/components/facebook/FacebookCommentsManager.tsx` - Tracking logic in manager + toast
3. Both files have:
   - `deletedCountRef` to track deleted count
   - Updated comparison logic
   - Reset on video change
