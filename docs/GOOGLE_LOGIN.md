# Đăng nhập Google
Tạo OAuth Client loại Web application trong Google Cloud / Google Auth Platform. Khai báo tên ứng dụng, email hỗ trợ và test users khi ứng dụng ở chế độ Testing.

Authorized JavaScript origin:
https://muonthietbisuctre.suctreclub.workers.dev

Authorized redirect URI:
https://muonthietbisuctre.suctreclub.workers.dev/api/auth/google/callback

Cloudflare Worker Production → Variables and Secrets:
- GOOGLE_CLIENT_ID: Client ID của OAuth client.
- GOOGLE_CLIENT_SECRET: Secret; không đưa vào GitHub.

Deploy rồi thử bằng một tài khoản Google chưa có trên web. Tài khoản mới chỉ có vai trò Người mượn. Tài khoản đã đăng ký bằng mật khẩu không được tự liên kết qua email. Đăng nhập Google lần sau xác nhận googleSub đã lưu. Không cấp vai trò staff/board từ tham số trình duyệt.

Kiểm thử:
- node --experimental-strip-types --test tests/*.test.ts
- TEST_BASE_URL=https://muonthietbisuctre.suctreclub.workers.dev node scripts/test-web.mjs

Bộ HTTP kiểm tra web thật nhưng không thay thế kiểm thử giao diện trình duyệt hoặc xác nhận đăng nhập Google thật. Kiểm tra thủ công: đồng ý, từ chối quyền, callback hết hạn, đăng xuất và đăng nhập lại. Chỉ ghi tích hợp hoạt động sau khi thử bằng OAuth client thật.

Google phải cho phép chính xác URL callback của tên miền website đang dùng. Khi đổi workers.dev subdomain, cần cập nhật Authorized redirect URI trong Google Cloud Console; thay đổi mã nguồn không tự cập nhật OAuth Client.
