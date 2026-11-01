# Cloudflare Workers Free: không ngủ sau 15 phút, chi phí 0 đồng trong hạn mức

## Kiến trúc

- Frontend: giữ nguyên giao diện NẾP Studio dưới `public/`, phục vụ bằng Cloudflare Static Assets.
- Backend: `cloudflare/worker.mjs` gọi `cloudflare/handler.mjs` (không cần Node.js server chạy liên tục).
- Database: dùng **Neon PostgreSQL hiện tại**, không tạo database mới và không xóa dữ liệu.
- Domain: dùng subdomain HTTPS miễn phí dạng `https://nep-studio-always-on.<ten-tai-khoan>.workers.dev`.
- Giữ Render cũ làm dự phòng đến khi xác nhận site Cloudflare hoạt động.

## Triển khai qua GitHub (không cần cung cấp API token trong chat)

1. Đăng nhập https://dash.cloudflare.com/ hoặc tạo tài khoản Free.
2. Vào **Workers & Pages → Create** và tạo Worker từ **GitHub repository**.
3. Chọn repository `LvK2606/nep-studio-fullstack-demo`.
4. Chọn branch `feature/cloudflare-workers-free` (không chọn `main` vì `main` vẫn phục vụ Render).
5. Đặt tên Worker **`nep-studio-always-on`** (phải khớp trường `name` trong `wrangler.jsonc`).
6. Root directory: repo root (để trống). **Build command**: để trống. **Deploy command**: `npx wrangler deploy`.
7. Kết nối GitHub và thực hiện deploy đầu tiên. Nếu API trả 503 ở giai đoạn này là bình thường do chưa có Secrets.

### Secrets bắt buộc

Trong Worker mới → **Settings → Variables and Secrets**, thêm ba giá trị dạng **Secret**, tuyệt đối không commit vào GitHub:

| Secret | Nhập giá trị nào |
|---|---|
| `DATABASE_URL` | Chuỗi PostgreSQL **pooled** từ project Neon `nep-studio`, database `nepstudio` |
| `ADMIN_PASSWORD` | Tự đặt mật khẩu mới, ít nhất 12 ký tự (không dùng lại mật khẩu đã đăng trong chat) |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên tối thiểu 48 ký tự, dùng riêng cho Cloudflare |

Lấy `DATABASE_URL` tại https://console.neon.tech → `nep-studio` → **Connect**.
Chọn database `nepstudio`, loại kết nối **Pooled**, copy URL. Không gửi URL hoặc khóa bí mật trong chat.

Để tạo SESSION_SECRET bằng Node.js trên máy tính cá nhân:
```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Sau khi lưu các Secrets, deploy lại bản Worker nếu Cloudflare yêu cầu. Trường `HOST`, `PORT` và `NODE_ENV` không cần thiết trên Workers.

### Kiểm tra sau khi triển khai

1. Mở root `/`: trang chủ phải hiển thị.
2. Mở `/api/services`: trả về 3 dịch vụ mẫu từ Neon.
3. Mở `/admin`: tải trang quản trị.
4. Dùng **dữ liệu giả**, tạo lịch trên site Cloudflare, xác nhận đã có trên dashboard; việc đặt trùng giờ phải trả HTTP 409.
5. Kiểm tra database trên Neon có bản ghi. Chờ 20 phút không truy cập và mở lại trang chủ: Cloudflare không có cơ chế ngủ 15 phút như Render.
6. Kiểm tra cùng bản ghi trên dashboard sau đó, hoặc qua bản Render nếu vẫn chạy và trỏ cùng Neon.

### Giới hạn thực tế

- Workers Free: **100.000 lần gọi Worker/ngày**, **10 ms CPU/request**. Chờ truy vấn mạng tới Neon không tính vào CPU time. Tài nguyên có thể thay đổi theo chính sách.
- Request đến **static assets miễn phí và không giới hạn** theo gói Static Assets hiện tại.
- Neon Free có hạn mức storage và compute; cơ sở dữ liệu có thể có độ trễ đánh thức khi không hoạt động. Không bảo đảm uptime 100%.
- Website vẫn là **portfolio demo**, chưa được đánh giá đủ bảo mật, chống spam, sao lưu, riêng tư dữ liệu để phục vụ khách hàng thật.
- Bản Render chưa bị xóa; đừng xóa trước khi kiểm thử Cloudflare thành công.

### Kiểm thử và mã nguồn

```bash
npm install
npm test
npm run dev:cloudflare
```

Khi chạy Wrangler trên máy local, cấu hình `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` bằng file `.dev.vars` được gitignore, hoặc dùng cơ chế Secrets của Wrangler. Không commit bí mật.

Tài liệu chính thức:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/

## Kích hoạt build sau khi đổi Production branch

Nếu Cloudflare trước đây deploy từ `main`, sau khi đặt `feature/cloudflare-workers-free` làm Production branch, **một lần push mới lên nhánh này** sẽ kích hoạt production build. Kiểm tra trong tab **Deployments**: bản build mới phải hiển thị nhánh `feature/cloudflare-workers-free`, thay vì `main`. Trạng thái `Ready` chỉ xác nhận deploy hoàn tất, chưa chứng minh các API có thể kết nối Neon.

Sau khi Cloudflare báo `Ready`, kiểm tra ngay `https://<subdomain>.workers.dev/api/services` trả về JSON với 3 dịch vụ. Nếu nhận `503`, kiểm tra tên và môi trường (Production) của ba Secrets; nếu nhận `500`, kiểm tra log Worker và URL PostgreSQL đã nhập. Không gửi giá trị Secret hoặc chuỗi kết nối vào chat.
