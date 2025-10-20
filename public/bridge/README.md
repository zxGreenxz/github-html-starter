# Thermal Printer Bridge Server

## 🚀 Khởi động

```bash
cd public/bridge
npm install
npm start
```

Server sẽ chạy trên: **http://localhost:9100**

## 📡 Endpoints

### POST /print/html
In HTML với Puppeteer + Sharp

**Parameters:**
- `printerIp`: IP máy in
- `printerPort`: Port máy in (thường là 9100)
- `html`: HTML content
- `width`: Chiều rộng (pixels, default: 576)
- `height`: Chiều dài (pixels, null = auto)
- `threshold`: Độ đậm (0-255, default: 95)
- `scale`: Device scale factor (default: 2)

### GET /health
Health check endpoint

## ⚙️ Settings mặc định

- **Port**: 9100
- **Width**: 576px (80mm full width)
- **Height**: Auto
- **Threshold**: 95 (bold text)
- **Scale**: 2x (high quality)

## 📖 Hướng dẫn chi tiết

Xem **CUSTOM-SIZE-GUIDE.md** để tùy chỉnh size in.

## 🔧 Cài đặt

### Requirements
- Node.js 14.x trở lên
- npm

### Installation
```bash
npm install
```

### Run
```bash
node bridge-server.js
```

hoặc

```bash
npm start
```

### Test
Mở browser và truy cập:
```
http://localhost:9100/health
```

Nếu thấy response JSON → Server đang chạy OK!

## 🐛 Troubleshooting

### Port 9100 bị chiếm
- Tắt ứng dụng đang dùng port 9100
- Hoặc đổi PORT trong `bridge-server.js`:
  ```javascript
  const PORT = 9200; // Thay đổi port khác
  ```

### Không kết nối được máy in
- Kiểm tra IP máy in
- Ping thử: `ping 192.168.1.100`
- Đảm bảo máy in đã bật và kết nối mạng

### npm: command not found
- Cài Node.js: https://nodejs.org
- Restart terminal sau khi cài

---

**Version:** 2.0  
**Port:** 9100  
**Updated:** 2025-10-20