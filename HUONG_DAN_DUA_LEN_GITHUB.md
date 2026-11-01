# Đưa dự án NẾP Studio lên GitHub

## Bước 1: Repository đã được tạo

Repository hiện có: https://github.com/LvK2606/nep-studio-fullstack-demo

Repository đã có commit tài liệu. Script bên dưới tự clone đúng nhánh `main` rồi đồng bộ source, tránh lỗi `non-fast-forward` do lịch sử commit có sẵn.

## Bước 2: Đẩy mã nguồn

### Windows - tiện nhất
1. Cài Git for Windows nếu chưa có: https://git-scm.com/downloads/win
2. Giải nén ZIP và chạy `PUSH_GITHUB_WINDOWS.bat`.
3. Dán URL repository ở bước 1 khi được hỏi.
4. Nếu Git yêu cầu đăng nhập, hãy đăng nhập trong cửa sổ xác thực GitHub chính thức.

### macOS/Linux hoặc thao tác thủ công
Mở terminal tại thư mục có `package.json`:

```bash
git clone https://github.com/LvK2606/nep-studio-fullstack-demo.git nep-studio-remote
# Sao chép các file nguồn từ thư mục ZIP đã giải nén vào nep-studio-remote
# Tuyệt đối không sao chép .env, database hoặc thư mục node_modules
cd nep-studio-remote
git add -A
git status --short
git commit -m "feat: add complete NEP Studio full-stack booking demo"
git push origin main
```

Nếu Git yêu cầu tên/email, hãy cấu hình Git identity của **bạn**, rồi chạy lại lệnh commit. Không dán access token hay mật khẩu vào chat.

## Bước 3: Kiểm tra an toàn

Trên GitHub, xác nhận `README.md`, `.env.example`, `server.mjs`, `src/`, `public/`, `tests/` và `docs/screenshots/` đã xuất hiện. **Không được có** `.env`, `data/bookings.sqlite`, hoặc các file `*.sqlite-*`.

## Bước 4: Chạy demo trên máy

```bash
npm run setup
npm start
npm test
```

- Trang chủ: http://localhost:3000/
- Quản trị: http://localhost:3000/admin

**Quan trọng:** GitHub chỉ lưu mã nguồn; không đồng nghĩa website được triển khai trên Internet.
