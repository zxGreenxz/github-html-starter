# Hướng dẫn sửa lỗi CORS Authentication

## Vấn đề hiện tại

Ứng dụng tại `https://n2store.vercel.app` đang gặp lỗi CORS khi cố gắng xác thực với Supabase:

```
Access to fetch at 'https://xneoovjmwhzzphwlwojc.supabase.co/auth/v1/token?grant_type=password'
from origin 'https://n2store.vercel.app' has been blocked by CORS policy
```

## Nguyên nhân

Supabase backend chưa được cấu hình để chấp nhận requests từ domain Vercel của bạn.

## Cách khắc phục

### Phương pháp 1: Cập nhật qua Supabase Dashboard (Khuyến nghị)

1. **Truy cập Supabase Dashboard**
   - Đi đến: https://supabase.com/dashboard
   - Chọn project: `xneoovjmwhzzphwlwojc`

2. **Cấu hình URL Authentication**
   - Vào mục: **Authentication** → **URL Configuration**
   - Cập nhật các trường sau:

   **Site URL:**
   ```
   https://n2store.vercel.app
   ```

   **Redirect URLs:** (Thêm tất cả các URLs sau)
   ```
   https://n2store.vercel.app/**
   https://n2store.vercel.app
   http://localhost:5173/**
   http://localhost:*/**
   ```

3. **Lưu thay đổi**
   - Click nút **Save**
   - Đợi vài giây để cấu hình được áp dụng

### Phương pháp 2: Deploy cấu hình từ config.toml (Nếu có Supabase CLI)

File `supabase/config.toml` đã được cập nhật với cấu hình auth:

```toml
[auth]
site_url = "https://n2store.vercel.app"
additional_redirect_urls = ["https://n2store.vercel.app/**", "http://localhost:*/**"]
enable_signup = true
```

Để áp dụng cấu hình này:

```bash
# Nếu bạn có Supabase CLI
supabase link --project-ref xneoovjmwhzzphwlwojc
supabase db push
```

## Kiểm tra sau khi sửa

1. Mở trình duyệt ở chế độ ẩn danh (Incognito)
2. Truy cập: https://n2store.vercel.app/auth
3. Thử đăng nhập với tài khoản của bạn
4. Kiểm tra Console (F12) để xác nhận không còn lỗi CORS

## Lưu ý quan trọng

- **Đợi một chút:** Sau khi lưu thay đổi trong Dashboard, đợi 10-30 giây để cấu hình được áp dụng
- **Xóa cache:** Nếu vẫn gặp lỗi, thử xóa cache trình duyệt hoặc dùng chế độ ẩn danh
- **Kiểm tra URL:** Đảm bảo URL trong Dashboard khớp chính xác với URL Vercel của bạn

## Thông tin thêm

- Supabase Project ID: `xneoovjmwhzzphwlwojc`
- Production URL: `https://n2store.vercel.app`
- Supabase URL: `https://xneoovjmwhzzphwlwojc.supabase.co`

## Hỗ trợ

Nếu vẫn gặp vấn đề sau khi thực hiện các bước trên:
1. Kiểm tra lại các URL đã nhập không có khoảng trắng thừa
2. Đảm bảo đã lưu thay đổi trong Supabase Dashboard
3. Thử đăng xuất và đăng nhập lại Supabase Dashboard
4. Kiểm tra Supabase Service Status: https://status.supabase.com/
