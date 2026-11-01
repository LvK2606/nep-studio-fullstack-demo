# Checklist kỹ thuật — Demo Full-stack NẾP studio

> Đánh dấu `[x]` khi bạn **tự kiểm tra được** trên máy và ghi lại bằng chứng (ảnh chụp, video ngắn hoặc kết quả test). Đây là checklist nghiệm thu và học kỹ năng; không tự coi mọi mục đã hoàn tất nếu chưa chạy lại.

## A. Khởi động & môi trường

- [ ] Kiểm tra `node --version` (>= 22.13) và `npm --version`.
- [ ] Chạy `npm run setup`, lưu mật khẩu; kiểm tra đã tạo `.env`.
- [ ] Chạy `npm start`, mở `http://localhost:3000` và `/admin`.
- [ ] Xác nhận SQLite được tạo trong `data/bookings.sqlite`.
- [ ] Xác nhận `.env`, file database không bị Git theo dõi.

## B. Frontend cho khách hàng

- [ ] Trang chủ hiển thị tốt trên desktop (>= 1280px).
- [ ] Trên màn hình mobile (~375px), không có tràn ngang bất thường.
- [ ] Danh sách dịch vụ được lấy từ API (không hard-code ở HTML).
- [ ] Nút “Chọn dịch vụ” chọn đúng gói trong form.
- [ ] Form có label, trạng thái lỗi và trạng thái thành công rõ ràng.
- [ ] Thay đổi ngày thì danh sách khung giờ được tải lại.
- [ ] Khung giờ đã có lịch bị disabled.
- [ ] Gửi thành công trả về mã lịch và trạng thái chờ.
- [ ] Thử gửi khi offline và kiểm tra thông báo lỗi không làm hỏng trang.

## C. Backend / API

- [ ] `GET /api/services` trả về ba dịch vụ từ SQLite.
- [ ] `GET /api/availability?date=...` trả về khung giờ hợp lệ.
- [ ] Đặt một lịch qua `POST /api/bookings` thành công (HTTP 201).
- [ ] Đặt cùng ngày/giờ lần hai bị từ chối (HTTP 409).
- [ ] Tên quá ngắn, số điện thoại sai, ngày cũ bị từ chối (HTTP 400).
- [ ] Đặt lịch quá 60 ngày trong tương lai bị từ chối.
- [ ] Nếu một lịch được hủy, giờ đó có thể được đặt lại.
- [ ] Nội dung gửi lên API lớn vượt giới hạn bị từ chối.

## D. Admin & trạng thái

- [ ] Chưa đăng nhập không xem được `GET /api/admin/bookings` (401).
- [ ] Nhập sai mật khẩu hiển thị lỗi; mật khẩu đúng đăng nhập được.
- [ ] Lịch vừa đặt xuất hiện trong dashboard sau khi làm mới.
- [ ] Tìm theo tên / số điện thoại hoạt động.
- [ ] Lọc trạng thái hoạt động.
- [ ] Chuyển `pending` -> `confirmed` -> `completed` thành công.
- [ ] `completed` không thể chuyển về `pending`.
- [ ] Hủy `pending` hoặc `confirmed` hoạt động.
- [ ] Đăng xuất rồi tải lại thì không xem được API quản trị.

## E. Bảo mật, dữ liệu và chất lượng

- [ ] `npm test` chạy toàn bộ integration tests và báo PASS.
- [ ] Không hiển thị mật khẩu hoặc SESSION_SECRET trong mã frontend.
- [ ] Cookie đăng nhập có `HttpOnly`, `SameSite=Strict`.
- [ ] Phía server vẫn kiểm tra dữ liệu dù frontend có kiểm tra.
- [ ] Phía frontend không dùng `innerHTML` để render tên khách hàng lấy từ API.
- [ ] Kiểm tra trình duyệt bằng DevTools Console / Network.
- [ ] Chỉ dùng thông tin giả khi thử nghiệm, không lưu PII thật.
- [ ] Kiểm tra `git status` và cập nhật README trung thực.

## F. Portfolio & bàn giao

- [ ] Chụp 3 hình: trang chủ, form đặt lịch, trang quản trị.
- [ ] Quay demo 60–90 giây: đặt lịch -> đăng nhập admin -> xác nhận.
- [ ] Đưa code lên GitHub (không gồm `.env` và database).
- [ ] Có link demo triển khai an toàn hoặc video chạy local.
- [ ] README ghi rõ stack, chức năng, cách chạy, hạn chế production.
- [ ] Nói được vòng đời của một booking: form -> API -> SQLite -> dashboard.
- [ ] Nói được cách tránh hai khách đặt trùng giờ, cách bảo vệ API admin.

## G. Nâng cấp nếu muốn nhận dự án full-stack thực tế

- [ ] Thiết kế schema hỗ trợ nhiều nhân viên, mỗi dịch vụ có thời lượng khác nhau.
- [ ] Thêm danh sách ngày nghỉ/ca nghỉ và thời gian buffer.
- [ ] Thêm phân quyền, tài khoản nhân viên, audit log, đổi/reset mật khẩu.
- [ ] Thêm gửi email/SMS xác nhận và cơ chế chống gửi spam.
- [ ] Thêm chính sách quyền riêng tư, lưu giữ/xóa dữ liệu.
- [ ] Thêm backup, monitoring, HTTPS, CI/test tự động khi deploy.
- [ ] Làm việc với khách hàng để thống nhất quy trình, quy tắc đặt lịch, SLA và bảo trì.

## Kịch bản demo 90 giây

1. (0–20s) Giới thiệu 3 dịch vụ và giao diện mobile/desktop.
2. (20–40s) Chọn dịch vụ, ngày, giờ và đặt lịch bằng dữ liệu giả.
3. (40–65s) Đăng nhập `/admin`, cho thấy lịch vừa tạo.
4. (65–80s) Bấm xác nhận, xem số liệu thay đổi.
5. (80–90s) Thử đặt trùng giờ và giải thích vì sao backend từ chối.

**Lời giới thiệu ngắn:** “Đây là demo full-stack đặt lịch dịch vụ mình thực hiện với hỗ trợ AI: frontend lấy dữ liệu từ API Node.js, backend lưu lịch hẹn vào SQLite, ngăn trùng khung giờ và có dashboard quản trị được bảo vệ bằng đăng nhập. Mình đang tiếp tục hoàn thiện kiểm thử và các yêu cầu production.”
