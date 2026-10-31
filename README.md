# Sức Trẻ — Quản lý mượn trả thiết bị

Web học phần MIS3047, Nhóm 1. React, TypeScript, Vinext, Cloudflare Workers, D1, R2. Giao diện tiếng Việt; chuyển ba vai trò để diễn tập. Chưa phải phân quyền ba tài khoản CLB độc lập.

## Chạy

Node >=22.13; cài dependencies theo pnpm-lock.yaml. `npm run dev`, `npm run build`. `npm run db:generate` sinh migration khi thay schema. Áp dụng migration D1 trước chạy local. Bản hosted được Sites áp dụng migration trong publication.

Kiểm tra: `node --experimental-strip-types --test tests/*.test.ts`; `node node_modules/typescript/bin/tsc --noEmit`.

## Kết nối và demo

1. Phụ trách: thêm thiết bị thật hoặc nạp danh mục demo có ghi rõ giả lập.
2. Người mượn: tạo đơn với lịch tương lai, mục đích, thiết bị và số lượng.
3. Phụ trách: Kiểm tra mô tả (sau khi có AI); xác nhận thủ công hoặc dùng pipeline tự chuyển nhánh khi đã hiệu chuẩn và bật.
4. Ban chủ nhiệm duyệt nếu mượn >24 giờ, giá trị cao hoặc chưa đặt ngưỡng. Giữ thiết bị kiểm tồn lại và ngăn giữ trùng.
5. Phụ trách kiểm tra, bàn giao; người mượn ký nhận.
6. Phụ trách kiểm tra trả. Nếu nguyên vẹn thì hoàn tất; nếu hỏng/mất, ghi số lượng, tải ảnh, soạn biên bản, sửa, nhập họ tên và xác nhận. Tiền bồi thường phải có người duyệt và căn cứ thực tế.
7. Người mượn báo đã bồi thường, phụ trách đối chiếu thực nhận. Khoản một phần giữ nợ; sau 7 ngày có thông báo để Ban chủ nhiệm xử lý.
8. Xem Thông báo, Nhật ký; Thiết lập có trạng thái kết nối, hiệu chuẩn, lần chạy nền gần nhất.

## Cấu trúc mã nguồn

| Muốn xem | File / thư mục |
|---|---|
| Giao diện web | `app/page.tsx` |
| Màu sắc, bố cục | `app/globals.css` |
| Xử lý mượn–trả | `lib/workflow.ts` |
| Kết nối và gọi AI | `lib/ai.ts` |
| Kiểm tra kết quả AI | `lib/ai-schema.ts` |
| Kiểm chứng ngưỡng tin cậy | `lib/calibration.ts` |
| Tự động hóa quy trình | `lib/automation.ts` |
| Xử lý nền và email | `lib/jobs.ts`, `lib/mail.ts` |
| Kiểm soát xử lý đồng thời | `lib/locking.ts` |
| API, lưu dữ liệu | `app/api/`, `lib/storage.ts` |
| Xử lý ảnh biên bản | `app/api/photos/`, `lib/evidence.ts` |
| Cấu trúc cơ sở dữ liệu | `db/schema.ts`, `drizzle/` |
| Cấu hình Cloudflare | `worker/index.ts`, `vite.cloudflare.config.ts` |
| Hướng dẫn triển khai | `docs/CLOUDFLARE.md` |
| Kiểm thử | `tests/` |

## Mã nguồn để giải trình

- `lib/workflow.ts`: quản lý trạng thái đơn mượn, kiểm tra luật nghiệp vụ, số lượng thiết bị còn khả dụng theo lịch và xử lý bồi thường.
- `lib/ai.ts`, `lib/ai-schema.ts`: gọi AI từ máy chủ, quy định cấu trúc kết quả và đối chiếu thông tin AI trả về với dữ liệu gốc.
- `lib/calibration.ts`: đánh giá kết quả AI trên bộ dữ liệu có nhãn trước khi cho phép tự chuyển nhánh theo ngưỡng tin cậy 0,95.
- `lib/automation.ts`: kết hợp AI với luật nghiệp vụ để xử lý đơn và tạo lời nhắc quá hạn; sử dụng mẫu dự phòng khi AI không hoạt động.
- `lib/jobs.ts`, `lib/mail.ts`, `lib/locking.ts`: kiểm tra các mốc thời gian, quản lý hàng đợi email, kiểm tra trạng thái trước khi gửi và hạn chế xử lý trùng hoặc đồng thời.
- `app/api/state/`, `lib/storage.ts`: tiếp nhận thao tác từ giao diện, kiểm tra dữ liệu và đọc/ghi cơ sở dữ liệu.
- `app/api/photos/`, `lib/evidence.ts`: kiểm tra định dạng, dung lượng, lưu ảnh và cung cấp ảnh cho quá trình lập biên bản.
- `app/api/maintenance/`: cung cấp endpoint chạy bộ xử lý nền. Endpoint này hiện bị khóa trên bản demo Cloudflare công khai.
- `db/schema.ts`, `drizzle/`: khai báo bảng và lưu các phiên bản thay đổi cấu trúc cơ sở dữ liệu D1.
- `worker/index.ts`, `vite.cloudflare.config.ts`: cấu hình triển khai Cloudflare độc lập, dùng tài khoản email/mật khẩu và không yêu cầu đăng nhập ChatGPT.
- `tests/`: kiểm thử nghiệp vụ, cấu trúc kết quả AI, ngưỡng tin cậy, các mốc thời gian, email và lưu dữ liệu trong môi trường mô phỏng. Các kiểm thử không gọi AI hoặc gửi email thật.

## Phạm vi bản demo

- Mỗi email có một tài khoản với một vai trò cố định; máy chủ kiểm tra quyền trên từng thao tác.
- Các tài khoản dùng chung dữ liệu CLB; người mượn chỉ xem và thao tác đơn của mình.
- AI cần cấu hình khóa API và `AI_MODEL` phía máy chủ.
- Email và kho ảnh cần được cấu hình riêng để sử dụng.
- Bộ xử lý nền chưa được bật trên bản Cloudflare công khai.

## Tài khoản và quyền truy cập

Đăng ký Người mượn không cần mã. Đăng ký Phụ trách thiết bị hoặc Ban chủ nhiệm yêu cầu mã do chủ website cấp; cấu hình hai Secret `STAFF_ACCESS_CODE` và `BOARD_ACCESS_CODE` trong Cloudflare. Không công khai mã trên GitHub. Hướng dẫn demo chuyển vai trò ở trên chỉ áp dụng bản cũ; với bản này phải đăng xuất và đăng nhập tài khoản đúng vai trò. Xem `docs/CLOUDFLARE.md`.
