# Gửi email qua Gmail (không cần Resend, không cần tên miền riêng)

Website hỗ trợ hai dịch vụ gửi email, chọn bằng biến Cloudflare `EMAIL_PROVIDER`:
- `gmail_script`: Google Apps Script dùng Gmail của CLB (đề xuất cho bản demo/CLB nhỏ).
- Không đặt biến này: tiếp tục dùng Resend nếu `RESEND_API_KEY` và `MAIL_FROM` đã cấu hình.

## Thiết lập một lần cho người quản lý (người dùng không cần làm)

1. Đăng nhập tài khoản Gmail chuyên dùng cho CLB.
2. Mở https://script.google.com/ và tạo dự án Apps Script.
3. Dán nội dung file [gmail-apps-script.gs](./gmail-apps-script.gs) vào `Code.gs`.
4. Mở **Project Settings → Script properties** và thêm `GMAIL_SCRIPT_SECRET` là một chuỗi ngẫu nhiên dài ít nhất 32 ký tự. **Không đưa chuỗi này lên GitHub.**
5. Deploy → New deployment → Web app → **Execute as: Me** và **Who has access: Anyone**. Cấp quyền MailApp theo yêu cầu của Google. Chọn chế độ này để khách sử dụng web không cần đăng nhập Google vào Apps Script; mỗi yêu cầu gửi thư vẫn phải có secret riêng ở máy chủ.
6. Sao chép URL Web app kết thúc bằng `/exec`.
7. Cloudflare → Worker `muonthietbisuctre` → Settings → Variables and Secrets:
   - `EMAIL_PROVIDER` = `gmail_script`
   - `GMAIL_SCRIPT_URL` = URL `/exec` vừa sao chép
   - `GMAIL_SCRIPT_SECRET` = cùng secret đã đặt trong Script Properties (Secret, không phải public variable)
8. Deploy và gửi mã xác minh đến một email thử nghiệm. Kiểm tra hộp thư đến và Spam. Kiểm tra đặt lại mật khẩu.
9. Khi cập nhật Apps Script, cần cập nhật deployment sang phiên bản mới.

Không chia sẻ URL deployment kèm khóa, không dùng mật khẩu Gmail trong website. Các biến trên là bí mật server-side. Có thể bỏ cấu hình Resend sau khi Gmail đã hoạt động.

**Giới hạn:** Tài khoản Gmail cá nhân theo hạn mức Apps Script hiện có khoảng 100 người nhận/ngày (Google có thể thay đổi), phù hợp CLB nhỏ, chưa phù hợp lưu lượng lớn. Email đã được dịch vụ chấp nhận không bảo đảm sẽ luôn đến Inbox. Nếu cần gửi nhiều thư, dùng tên miền riêng và nhà cung cấp email giao dịch chuyên dụng.

**Lưu ý bảo mật:** Endpoint Apps Script công khai theo quyền `Anyone` nhưng chỉ gửi khi khớp secret; nếu lộ secret phải thay ngay cả hai nơi. Phía server kiểm tra URL phải là `script.google.com`. Hạn mức Google áp dụng cho tài khoản chủ triển khai.
