# Triển khai NẾP Studio lên Render Free (đường dẫn miễn phí)

> **Chỉ dùng để trình diễn portfolio với dữ liệu giả.** Bản hiện tại sử dụng SQLite lưu trong filesystem của server. Render Free sẽ xóa thay đổi của ổ đĩa khi service ngủ, khởi động lại hoặc redeploy. **Không tiếp nhận lịch hẹn, số điện thoại của người dùng thật.**

## 1. Tạo Web Service

1. Vào https://dashboard.render.com/ và đăng ký/đăng nhập.
2. Chọn **New → Web Service** và kết nối GitHub.
3. Chọn repo `LvK2606/nep-studio-fullstack-demo`, branch `main`.
4. Cấu hình:

| Trường | Giá trị |
|---|---|
| Name | `nep-studio-fullstack-demo` (hoặc tên còn trống) |
| Language / Runtime | `Node` |
| Branch | `main` |
| Root Directory | để trống |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

Node version được pin ở `.node-version` (22.16.0).

## 2. Thêm Environment Variables (KHÔNG commit lên GitHub)

Trong Render → Environment, tạo:

| Key | Value |
|---|---|
| `HOST` | `0.0.0.0` |
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | mật khẩu bí mật của bạn, dài **ít nhất 12 ký tự** |
| `SESSION_SECRET` | chuỗi ngẫu nhiên **ít nhất 48 ký tự** |

Để tạo `SESSION_SECRET` ngẫu nhiên trên máy đã cài Node.js, chạy:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Sao chép chuỗi kết quả vào Render. **Không** dán khóa/mật khẩu vào tin nhắn, mã nguồn hay ảnh chụp màn hình. Render tự cung cấp `PORT`, không cần đặt `PORT` thủ công.

Lưu ý: **không chạy `npm run setup` trên Render**. Lệnh đó dùng để sinh file `.env` cho môi trường local và có thể làm lộ mật khẩu qua log.

## 3. Deploy

Nhấn **Create Web Service / Deploy Web Service** rồi kiểm tra log cho tới khi trạng thái **Live**.

Render tự cấp địa chỉ HTTPS theo mẫu `https://<ten-service>.onrender.com`. Tên chính xác phụ thuộc vào tên service còn khả dụng; đây là subdomain miễn phí, không phải quyền sở hữu một tên miền riêng `.com`.

Kiểm tra:

- `/`: giao diện đặt lịch.
- `/api/services`: danh sách dịch vụ JSON.
- `/admin`: trang đăng nhập quản trị.
- `/api/admin/me`: trạng thái phiên.
- Dùng thông tin **giả** để thử đặt lịch, đăng nhập, xác nhận, rồi hủy lịch.

## 4. Hạn chế cần nhớ

- Free web service ngủ sau khoảng **15 phút** không có truy cập; lần mở sau có thể mất **khoảng một phút** để chạy lại.
- **SQLite trên Render Free là dữ liệu tạm**: toàn bộ lịch hẹn đặt vào database local có thể mất bất cứ lúc nào do restart/redeploy/spin-down.
- Không có persistent disk trên Free. Không nên dùng bản này với khách thật.
- Gói miễn phí có giới hạn giờ, băng thông và tài nguyên.
- Nếu muốn một **full-stack demo lưu lịch hẹn bền vững**, cần thay SQLite local bằng một hệ thống lưu trữ bên ngoài như Turso, hoặc chuyển backend sang Cloudflare Workers + D1. Cả hai đều yêu cầu sửa code, kiểm thử lại và cấu hình thông tin truy cập.

Tài liệu: https://render.com/docs/free , https://render.com/docs/web-services , https://render.com/docs/node-version
