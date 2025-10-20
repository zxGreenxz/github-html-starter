# Thermal Printer Bridge Server v2.0

## 🚀 Hệ thống in nhiệt mới - Puppeteer + Sharp

### ✨ Tính năng

- ✅ **In HTML trực tiếp** - Không cần PDF trung gian
- ✅ **Chất lượng cao** - Puppeteer rendering + Sharp processing
- ✅ **Tiếng Việt 100%** - Hỗ trợ đầy đủ Unicode
- ✅ **Tùy chỉnh linh hoạt** - Width, height, threshold, scale
- ✅ **Chữ đậm** - Threshold 95 cho văn bản dễ đọc

### 📦 Cài đặt

1. **Cài đặt dependencies:**
```bash
cd public/bridge
npm install
```

2. **Chạy server:**
```bash
npm start
```

Server sẽ chạy tại `http://localhost:3001`

### 🔧 Cấu hình máy in

Mở trang cấu hình: `http://localhost:5173/printer-config.html`

**Thông tin cần thiết:**
- **Tên máy in**: VD: "Máy in bếp"
- **IP Address**: VD: "192.168.1.100"
- **Port**: Mặc định "9100"
- **Bridge URL**: `http://localhost:3001`

### 🖨️ Cài đặt in tối ưu

**Khuyến nghị cho giấy 80mm:**
- **Width**: 576px (80mm full width) ⭐
- **Height**: Auto (tự động theo nội dung) ⭐
- **Threshold**: 95 (chữ đậm) ⭐
- **Scale**: 2x (chất lượng cao) ⭐

**Tùy chỉnh:**
- **Width**: 200-800px (tùy kích thước giấy)
- **Height**: null/auto hoặc 400-3000px
- **Threshold**: 85-125 (thấp = đậm hơn)
- **Scale**: 1-3x (cao = nét hơn)

### 📡 API Endpoints

#### POST /print/html
In HTML thành bitmap

**Request:**
```json
{
  "printerIp": "192.168.1.100",
  "printerPort": 9100,
  "html": "<html>...</html>",
  "width": 576,
  "height": null,
  "threshold": 95,
  "scale": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Print completed successfully",
  "imageInfo": {
    "width": 576,
    "height": 800
  }
}
```

#### GET /health
Kiểm tra trạng thái server

**Response:**
```json
{
  "status": "ok",
  "service": "Thermal Printer Bridge (Full Width & Bold)",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "port": 3001,
  "defaultWidth": 576,
  "defaultThreshold": 95
}
```

### 🐛 Troubleshooting

**Server không khởi động:**
- Kiểm tra port 3001 có bị chiếm không
- Chạy lại `npm install`

**Không in được:**
- Kiểm tra máy in đã bật và kết nối mạng
- Ping IP máy in: `ping 192.168.1.100`
- Kiểm tra Bridge URL đúng chưa

**Chữ mờ/nhạt:**
- Giảm threshold (85-90 cho đậm hơn)
- Tăng scale (2.5x hoặc 3x)

**Bill bị cắt:**
- Dùng height: null (auto)
- Hoặc tăng giá trị height

### 📚 Migration từ hệ thống cũ

**Thay đổi code:**

```typescript
// CŨ (PDF):
import { printPDFToXC80 } from '@/lib/printer-utils';
import { generateBillPDF } from '@/lib/bill-pdf-generator';

const pdf = generateBillPDF(data);
const pdfUri = pdf.output('datauristring');
await printPDFToXC80(printer, pdfUri, {...});

// MỚI (HTML + Puppeteer):
import { printHTMLViaPuppeteer } from '@/lib/printer-utils';
import { generateBillHTML } from '@/lib/bill-html-generator';

const html = generateBillHTML(data);
await printHTMLViaPuppeteer(printer, html, {
  width: 576,
  height: null,
  threshold: 95,
  scale: 2
});
```

### 🎯 Lợi ích so với hệ thống cũ

| Tính năng | Cũ (PDF) | Mới (Puppeteer) |
|-----------|----------|-----------------|
| Chất lượng | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Tốc độ | Chậm | Nhanh |
| Tiếng Việt | OK | Tuyệt vời |
| Tùy chỉnh | Giới hạn | Linh hoạt |
| Dependencies | pdftoppm + sharp | Puppeteer + sharp |
| Maintenance | Phức tạp | Đơn giản |

### 📞 Support

Nếu gặp vấn đề, kiểm tra console logs của:
1. Bridge server (`npm start`)
2. Browser DevTools (F12)
3. Network tab để xem request/response

---

**Version**: 2.0.0  
**Last Updated**: 2025  
**License**: MIT
