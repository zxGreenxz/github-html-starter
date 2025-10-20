# 📐 Hướng Dẫn Tùy Chỉnh Kích Thước Bill

## ✨ Tính Năng Mới

Bây giờ bạn có thể tùy chỉnh **chiều dài** và **chiều rộng** của bill hoàn toàn theo ý muốn!

### 🎯 Các Tùy Chọn

1. **Width (Chiều rộng)** - Tùy chỉnh độ rộng bill
2. **Height (Chiều dài)** - Tùy chỉnh độ dài bill
3. **Threshold (Độ đậm)** - Tùy chỉnh độ đậm của chữ
4. **Scale (Tỷ lệ)** - Tùy chỉnh chất lượng render

## 📏 Width - Chiều Rộng

### Presets Có Sẵn

| Width | Khổ giấy | Khi nào dùng |
|-------|----------|--------------|
| 576px | 80mm | ⭐ Phổ biến nhất, khuyến nghị |
| 512px | 72mm | Khổ giấy lớn |
| 432px | 60mm | Khổ giấy trung bình |
| 384px | 54mm | Khổ giấy nhỏ |

### Custom Width

**Cách dùng:**
1. Chọn "Custom..." trong dropdown Width
2. Nhập số pixels (200-800)
3. Test in

**Ví dụ:**
- Máy in 58mm → width: 410px
- Máy in 76mm → width: 540px
- Máy in 90mm → width: 640px

**Công thức tính:**
```
Width (pixels) ≈ Khổ giấy (mm) × 7.2
```

**Ví dụ tính:**
- 80mm × 7.2 = 576px ✓
- 58mm × 7.2 = 418px ✓

## 📐 Height - Chiều Dài

### Presets Có Sẵn

| Height | Độ dài | Khi nào dùng |
|--------|--------|--------------|
| Auto | Tự động | ⭐ Khuyến nghị, fit theo nội dung |
| 800px | Ngắn | Bill có ít thông tin |
| 1000px | Trung bình | Bill thông thường |
| 1200px | Dài | Bill nhiều thông tin |
| 1500px | Rất dài | Bill có nhiều sản phẩm |

### Custom Height

**Cách dùng:**
1. Chọn "Custom..." trong dropdown Height
2. Nhập số pixels (400-3000)
3. Test in

**Lưu ý:**
- **Auto** (khuyến nghị): Chiều dài tự động theo nội dung
- **Fixed height**: Cắt hoặc thêm khoảng trắng để fit height

## ⚫ Threshold - Độ Đậm Chữ

### Presets Có Sẵn

| Threshold | Độ đậm | Khi nào dùng |
|-----------|--------|--------------|
| 85 | Rất đậm | Máy in chất lượng tốt |
| 95 | Đậm | ⭐ Khuyến nghị |
| 105 | Vừa | Giấy chất lượng trung bình |
| 115 | Cân bằng | Mặc định cũ |
| 125 | Nhẹ | Giấy chất lượng kém |

**Nguyên tắc:**
- Số **càng thấp** = chữ **càng đậm**
- Số **càng cao** = chữ **càng nhạt**

## 🔍 Scale - Tỷ Lệ Phóng To

### Presets Có Sẵn

| Scale | Chất lượng | Khi nào dùng |
|-------|-----------|--------------|
| 1x | Bình thường | In nhanh, chất lượng thấp |
| 1.5x | Tốt | Cân bằng tốc độ & chất lượng |
| 2x | Cao | ⭐ Khuyến nghị |
| 2.5x | Rất cao | Bill quan trọng |
| 3x | Tối đa | Chất lượng cao nhất, chậm |

**Lưu ý:**
- Scale cao = chữ nét hơn, file lớn hơn, xử lý lâu hơn
- Scale 2x là tối ưu cho hầu hết trường hợp

## 🎨 Các Trường Hợp Sử Dụng

### Case 1: Bill Tiêu Chuẩn (Khuyến Nghị)

```
Width: 576px (80mm)
Height: Auto
Threshold: 95
Scale: 2x
```

**Phù hợp cho:** Hầu hết các máy in 80mm

### Case 2: Bill Nhỏ Gọn

```
Width: 432px (60mm)
Height: Auto
Threshold: 95
Scale: 2x
```

**Phù hợp cho:** Máy in 58mm, 60mm

### Case 3: Bill Chất Lượng Cao

```
Width: 576px (80mm)
Height: Auto
Threshold: 85
Scale: 3x
```

**Phù hợp cho:** Bill quan trọng cần in rất rõ

### Case 4: Bill In Nhanh

```
Width: 432px (60mm)
Height: 800px
Threshold: 105
Scale: 1x
```

**Phù hợp cho:** Cần in nhanh, chất lượng đủ dùng

### Case 5: Custom Hoàn Toàn

```
Width: Custom (nhập tay)
Height: Custom (nhập tay)
Threshold: 95
Scale: 2x
```

**Phù hợp cho:** Máy in đặc biệt, khổ giấy khác thường

## 🚀 Cách Sử Dụng

### Bước 1: Mở Config

Double-click `printer-config.html`

### Bước 2: Chọn Width

**Option A:** Chọn preset (576px, 512px, 432px, 384px)

**Option B:** Chọn "Custom...", nhập số pixels

### Bước 3: Chọn Height

**Option A:** Chọn "Auto" (khuyến nghị)

**Option B:** Chọn preset (800px, 1000px, 1200px, 1500px)

**Option C:** Chọn "Custom...", nhập số pixels

### Bước 4: Chọn Threshold & Scale

Dùng mặc định (Threshold: 95, Scale: 2x) hoặc tùy chỉnh

### Bước 5: Test In

Nhấn "Test In Bill" và kiểm tra kết quả

### Bước 6: Điều Chỉnh

Nếu chưa ưng ý, thay đổi các tham số và test lại

## 📊 Live Preview

Trong phần "Kích thước hiện tại", bạn sẽ thấy:

```
Width: 576px
Height: Auto
Scale: 2x
```

Preview này cập nhật real-time khi bạn thay đổi settings.

## 💡 Tips & Tricks

### Tip 1: Tìm Width Phù Hợp

1. Đo khổ giấy máy in (mm)
2. Nhân với 7.2
3. Làm tròn đến bội số của 8

**Ví dụ:**
- 80mm → 80 × 7.2 = 576px ✓
- 58mm → 58 × 7.2 = 418 → **416px** (chia hết cho 8)

### Tip 2: Height Auto vs Fixed

**Dùng Auto khi:**
- ✅ Nội dung bill thay đổi
- ✅ Muốn tiết kiệm giấy
- ✅ Không biết chính xác độ dài

**Dùng Fixed khi:**
- ✅ Muốn tất cả bill cùng độ dài
- ✅ Có template cố định
- ✅ Cần căn chỉnh chính xác

### Tip 3: Threshold vs Giấy

| Loại giấy | Threshold khuyến nghị |
|-----------|----------------------|
| Giấy tốt, mới | 85-95 |
| Giấy thường | 95-105 |
| Giấy cũ, xấu | 105-115 |

### Tip 4: Scale vs Tốc Độ

| Scale | Thời gian xử lý | Chất lượng |
|-------|-----------------|-----------|
| 1x | ~1s | Thấp |
| 1.5x | ~1.5s | Trung bình |
| 2x | ~2s | Cao ⭐ |
| 2.5x | ~3s | Rất cao |
| 3x | ~4s | Tối đa |

### Tip 5: Custom Width cho Các Khổ Đặc Biệt

| Khổ giấy | Width đề xuất |
|----------|---------------|
| 48mm | 345px |
| 58mm | 418px |
| 76mm | 547px |
| 80mm | 576px ⭐ |
| 110mm | 792px |

## 🐛 Troubleshooting

### Bill bị cắt ngang

**Nguyên nhân:** Width quá lớn

**Giải pháp:** Giảm width xuống

### Bill quá ngắn/dài

**Nguyên nhân:** Height không phù hợp

**Giải pháp:** 
- Dùng "Auto" để tự động
- Hoặc tăng/giảm height

### Chữ quá mờ

**Nguyên nhân:** Threshold quá cao

**Giải pháp:** Giảm threshold (95 → 85)

### Chữ quá đậm (bị dính)

**Nguyên nhân:** Threshold quá thấp

**Giải pháp:** Tăng threshold (95 → 105)

### In chậm

**Nguyên nhân:** Scale quá cao

**Giải pháp:** Giảm scale (3x → 2x)

### Chữ không nét

**Nguyên nhân:** Scale quá thấp

**Giải pháp:** Tăng scale (1x → 2x)

## 📝 Code Example

### TypeScript

```typescript
import { printHTMLToXC80, getActivePrinter } from './printer-utils';

async function printCustomBill(html: string) {
  const printer = getActivePrinter();
  
  const result = await printHTMLToXC80(printer!, html, {
    width: 576,       // 80mm
    height: null,     // Auto
    threshold: 95,    // Bold
    scale: 2          // High quality
  });
  
  return result;
}

// Custom size
async function printSmallBill(html: string) {
  const printer = getActivePrinter();
  
  const result = await printHTMLToXC80(printer!, html, {
    width: 432,       // 60mm
    height: 800,      // Short
    threshold: 95,
    scale: 1.5        // Fast
  });
  
  return result;
}
```

### JavaScript

```javascript
async function printBill(html) {
  const response = await fetch('http://localhost:3001/print/html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printerIp: '192.168.1.100',
      printerPort: 9100,
      html: html,
      width: 576,       // Tùy chỉnh
      height: null,     // Auto
      threshold: 95,    // Tùy chỉnh
      scale: 2          // Tùy chỉnh
    })
  });
  
  return await response.json();
}
```

## ✅ Checklist

- [ ] Đã chọn width phù hợp với máy in
- [ ] Đã chọn height (Auto hoặc custom)
- [ ] Đã chọn threshold phù hợp với giấy
- [ ] Đã chọn scale cân bằng chất lượng/tốc độ
- [ ] Đã test in và kiểm tra
- [ ] Kết quả in đẹp, rõ ràng

## 📞 Support

Nếu cần trợ giúp:

1. Check live preview trong config
2. Test với nhiều settings khác nhau
3. Chụp ảnh bill in ra
4. Note lại settings đã dùng

---

**Updated:** 20/10/2025  
**Version:** 3.0 - Custom Size Support