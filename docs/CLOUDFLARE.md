# Cloudflare độc lập
Build: `pnpm run build:cloudflare`
Deploy: `pnpm run deploy:cloudflare`
D1 binding: `DB`; R2 binding: `BUCKET`.

## Tài khoản — một tài khoản chỉ có một vai trò
Trong Worker > Settings > Variables and Secrets, thêm hai Secret khác nhau do chủ website tự đặt:
- `STAFF_ACCESS_CODE`: mã cấp tài khoản Phụ trách thiết bị.
- `BOARD_ACCESS_CODE`: mã cấp tài khoản Ban chủ nhiệm.
Không đưa mã vào GitHub. Chỉ cung cấp mã tương ứng cho đúng người phụ trách. Thiếu mã, server từ chối đăng ký tài khoản đặc quyền. Người mượn đăng ký không cần mã. Email tài khoản là định danh, chưa xác minh quyền sở hữu email.
Mỗi email chỉ có một tài khoản và một vai trò; không được đổi vai trò bằng giao diện hay giả mạo payload. Đăng xuất để đăng nhập tài khoản khác.
Mật khẩu được băm PBKDF2 với salt riêng; phiên HttpOnly hết hạn sau 24 giờ và bị thu hồi khi đăng xuất.
Dữ liệu nghiệp vụ chung lưu dưới workspace `club:suctre`; người mượn chỉ truy cập đơn của mình. Tài khoản/phiên dùng các bản ghi riêng trong bảng workspaces đã có, không cần chạy thêm SQL. Dữ liệu demo trước đây vẫn còn trong D1 nhưng không tự ghép vào dữ liệu CLB mới. Phụ trách nạp danh mục một lần nếu danh mục chung trống.
Chưa có quên mật khẩu, xác minh email, quản trị tài khoản hoặc giới hạn đăng nhập theo IP. Cần bổ sung trước khi triển khai vận hành rộng rãi.
Endpoint maintenance vẫn khóa trên bản Cloudflare. AI/email/R2 cần cấu hình riêng.
