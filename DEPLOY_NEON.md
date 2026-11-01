# NẾP Studio: database bền vững với Neon PostgreSQL

Dự án giữ **SQLite khi chạy local**, tự động chuyển sang **PostgreSQL khi có `DATABASE_URL`**. Không cần thay đổi frontend. Database Neon nằm ngoài filesystem của Render, vì vậy không mất dữ liệu chỉ vì Render Free ngủ, khởi động lại hoặc deploy lại.

## 1. Tạo Neon database

1. Kết nối ứng dụng Neon trong ChatGPT hoặc truy cập https://console.neon.tech/.
2. Tạo project `nep-studio`; ưu tiên vùng gần Singapore.
3. Vào **Connect** và sao chép **pooled connection string** (PostgreSQL, `sslmode=require`).
4. KHÔNG công khai connection string vì có chứa mật khẩu truy cập database.

## 2. Thiết lập Render

1. Đảm bảo nhánh `feature/neon-postgres` đã kiểm thử và merge vào `main`.
2. Vào https://dashboard.render.com/ → dịch vụ `nep-studio-demo` → **Environment**.
3. Thêm `DATABASE_URL` bằng chuỗi kết nối Neon, chỉ đặt trên Render.
4. Giữ `ADMIN_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production`, `HOST=0.0.0.0`.
5. Save, deploy và kiểm tra log; nếu kết nối Neon lỗi, service phải báo lỗi chứ không tự fallback về SQLite.
6. Sau khi chạy thành công, đặt thêm `REQUIRE_PERSISTENT_DB=true` để không cho quay lại SQLite khi vô tình xóa `DATABASE_URL`.

**Không gửi DATABASE_URL, mật khẩu hoặc API token trong chat hay commit lên GitHub.** `.gitignore` đã bỏ qua file `.env`.

## 3. Kiểm thử dữ liệu bền vững

Với dữ liệu giả:
- Xem `/api/services` và `/admin`.
- Đặt lịch thử rồi xác nhận thấy xuất hiện trong dashboard.
- Thực hiện deploy lại (hoặc restart) và kiểm tra lịch vẫn tồn tại.
- Đặt lại cùng khung giờ phải bị từ chối 409; hủy lịch sẽ cho phép chọn lại.
- Xem danh sách lịch khi chưa đăng nhập phải bị từ chối 401.

**Cảnh báo:** dữ liệu SQLite có sẵn trên Render Free vốn là dữ liệu tạm, không tự đồng bộ sang Neon. Nếu có dữ liệu cần giữ, phải xuất và nhập bằng quy trình riêng trước khi chuyển.

## 4. Vẫn chưa phải production

Sau khi lưu dữ liệu bền vững, vẫn cần chống spam đặt lịch, sao lưu/phục hồi, bảo vệ thông tin khách hàng, cơ chế xóa dữ liệu, phân quyền người quản trị, giám sát lỗi, và thay mật khẩu admin đã từng hiển thị trong chat. Render Free vẫn ngủ sau 15 phút, có cold start và hạn mức tài nguyên.

Tham khảo chính thức:
- https://neon.com/pricing
- https://neon.com/docs/get-started/connect-neon
- https://render.com/docs/free
