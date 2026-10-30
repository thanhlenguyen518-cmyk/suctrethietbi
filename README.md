# Sức Trẻ — Quản lý mượn trả thiết bị

Web học phần MIS3047, Nhóm 1. React, TypeScript, Vinext, Cloudflare Workers, D1, R2. Giao diện tiếng Việt; không gian riêng đăng nhập ChatGPT, chuyển ba vai trò để diễn tập. Chưa phải phân quyền ba tài khoản CLB độc lập.

## Chạy

Node >=22.13; cài dependencies theo pnpm-lock.yaml. `npm run dev`, `npm run build`. `npm run db:generate` sinh migration khi thay schema. Áp dụng migration D1 trước chạy local. Bản hosted được Sites áp dụng migration trong publication.

Kiểm tra: `node --experimental-strip-types --test tests/*.test.ts`; `node node_modules/typescript/bin/tsc --noEmit`.

## Kết nối và demo

Đọc [docs/CONNECT_AI.md](docs/CONNECT_AI.md) để cấu hình, kiểm tra AI thật, hiệu chuẩn ngưỡng và bật email. Không lưu khóa trong Git hoặc nhập vào biểu mẫu. Lịch chạy nền và cơ chế truy cập ở [docs/AUTOMATION.md](docs/AUTOMATION.md).

1. Phụ trách: thêm thiết bị thật hoặc nạp danh mục demo có ghi rõ giả lập.
2. Người mượn: tạo đơn với lịch tương lai, mục đích, thiết bị và số lượng.
3. Phụ trách: Kiểm tra mô tả (sau khi có AI); xác nhận thủ công hoặc dùng pipeline tự chuyển nhánh khi đã hiệu chuẩn và bật.
4. Ban chủ nhiệm duyệt nếu mượn >24 giờ, giá trị cao hoặc chưa đặt ngưỡng. Giữ thiết bị kiểm tồn lại và ngăn giữ trùng.
5. Phụ trách kiểm tra, bàn giao; người mượn ký nhận.
6. Phụ trách kiểm tra trả. Nếu nguyên vẹn thì hoàn tất; nếu hỏng/mất, ghi số lượng, tải ảnh, soạn biên bản, sửa, nhập họ tên và xác nhận. Tiền bồi thường phải có người duyệt và căn cứ thực tế.
7. Người mượn báo đã bồi thường, phụ trách đối chiếu thực nhận. Khoản một phần giữ nợ; sau 7 ngày có thông báo để Ban chủ nhiệm xử lý.
8. Xem Thông báo, Nhật ký; Thiết lập có trạng thái kết nối, hiệu chuẩn, lần chạy nền gần nhất.

## Mã nguồn để giải trình

- `lib/workflow.ts`: trạng thái nghiệp vụ, kiểm tra luật, lịch tồn, bồi thường.
- `lib/ai.ts`, `lib/ai-schema.ts`: API máy chủ, schema chặt, kiểm khớp dữ liệu nguồn, ảnh và bản nháp.
- `lib/calibration.ts`: tiêu chí kiểm chứng ngưỡng 0,95 theo tập nhãn độc lập; không tạo kết quả kiểm thử giả.
- `lib/automation.ts`: nối AI → luật → chuyển nhánh; nhắc quá hạn có mẫu dự phòng.
- `lib/jobs.ts`, `lib/mail.ts`, `lib/locking.ts`: timer, hàng đợi email, kiểm trạng thái ngay trước khi gửi, chống trùng và khóa đồng thời.
- `app/api/state`, `app/api/photos`, `app/api/maintenance`: danh tính, giới hạn dữ liệu, lưu ảnh riêng, endpoint xử lý nền.
- `db/schema.ts`, `drizzle/`: migrations D1; không tạo bảng lúc xử lý request.
- `tests/`: nghiệp vụ, cấu trúc AI, ngưỡng, timer, email adapter và SQLite tích hợp (mô phỏng D1). Test không gọi AI/email thật.

## Nguồn và những chỗ chưa có quy định

Đã đọc yêu cầu MIS3047 và cả sáu tài liệu đính kèm. Quy trình chính lấy bảng 32 task ở `50K21.2_Nhóm-1_Hà Thái Bảo.docx` và BPMN TO-BE SVG nhúng trong `50K21.2_Nhom1_NguyenThanhLe.docx`. File Draw.io chỉ có As-is. Tài liệu đăng ký học phần khác đề tài, không trộn vào web. Hai tài liệu mô phỏng/định lượng dùng phân tích quy trình, không dùng làm số liệu chạy thật.

Chưa có ngưỡng giá trị cao: chuyển Ban chủ nhiệm, cho phép cấu hình. Chưa có công thức/đơn giá bồi thường: người có thẩm quyền nhập số tiền và căn cứ, không bịa công thức. Tổng giá trị đơn là diễn giải triển khai, cần nhóm đối chiếu CLB. Số liệu định lượng gốc có phép tính trung gian không nhất quán nên không hiển thị như kết quả đo thực.

AI chưa có khóa/mô hình thì chưa chạy thật. Email chưa cấu hình tài khoản/địa chỉ gửi và bật tùy chọn thì chỉ lưu nội bộ. Không có SMS, webhook delivered/bounce hoặc chữ ký số pháp lý. Danh mục theo loại/số lượng, chưa quản lý serial từng chiếc và bảo trì sửa chữa.
