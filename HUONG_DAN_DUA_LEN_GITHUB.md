# Đưa dự án NẾP Studio lên GitHub

## Bước 1: Tạo repository rỗng

Truy cập https://github.com/new khi đăng nhập tài khoản GitHub.

- Repository name: `nep-studio-fullstack-demo`
- Description: `Full-stack booking website demo | Node.js + SQLite + REST API + Admin Dashboard`
- Visibility: bạn chọn **Public** nếu muốn hiển thị trong portfolio; hoặc **Private** để chỉ bạn thấy.
- **Không chọn** `Add a README file`, `.gitignore`, `Choose a license` để tránh xung đột khi đẩy lần đầu.

Bấm **Create repository** rồi sao chép URL `https://github.com/<tai-khoan>/nep-studio-fullstack-demo.git`.

## Bước 2: Đẩy mã nguồn

### Windows - tiện nhất
1. Cài Git for Windows nếu chưa có: https://git-scm.com/downloads/win
2. Giải nén ZIP và chạy `PUSH_GITHUB_WINDOWS.bat`.
3. Dán URL repository ở bước 1 khi được hỏi.
4. Nếu Git yêu cầu đăng nhập, hãy đăng nhập trong cửa sổ xác thực GitHub chính thức.

### macOS/Linux hoặc thao tác thủ công
Mở terminal tại thư mục có `package.json`:

```bash
git init
git branch -M main
git add .
git status --short
git commit -m "Initial commit: NẾP Studio full-stack booking demo"
git remote add origin https://github.com/<tai-khoan>/nep-studio-fullstack-demo.git
git push -u origin main
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