# Kết nối AI và hoàn tất cấu hình

## Trên bản web đã triển khai

1. Cài OpenAI Developers trong ChatGPT, rồi yêu cầu tiếp tục cấu hình khóa API cho Site Sức Trẻ. Khóa dùng ở máy chủ, không dán vào chat, biểu mẫu đơn mượn, Git hoặc mã giao diện.
2. Chọn mô hình tài khoản được phép sử dụng, có hỗ trợ ảnh đầu vào và Structured Outputs trên Chat Completions. Lưu tên mô hình vào `AI_MODEL` và khóa vào secret `OPENAI_API_KEY`. Không mặc định rằng cài plugin là đã tạo khóa hoặc tài khoản đã có quyền gọi mọi mô hình.
3. Triển khai lại phiên bản sau khi thay đổi biến môi trường.
4. Đăng nhập web → vai trò Ban chủ nhiệm → Thiết lập → Kiểm tra kết nối AI. Thành công chỉ được ghi nhận sau khi dịch vụ trả về JSON đúng cấu trúc. Kết nối này thực hiện một lệnh gọi API với dữ liệu thử, có thể phát sinh phí.
5. Thử ba chức năng: Kiểm tra mô tả; Soạn lời nhắc trên lượt quá hạn; Soạn biên bản có ảnh. Mã và số lượng trong biên bản phải khớp hồ sơ; người phụ trách sửa và ký trước khi chuyển tiếp.

Đã chuẩn bị cấu hình endpoint `https://api.openai.com/v1`, JSON Schema và khả năng gửi ảnh. Chưa có khóa/mô hình thì trạng thái hiển thị chưa kết nối. Không có mô hình AI giả lập ở bản triển khai.

## Tự chuyển nhánh ở bước kiểm tra

Điểm tự đánh giá của mô hình không phải xác suất đã được chứng minh. Chức năng tự chuyển nhánh được xây dựng nhưng mặc định chưa bật.

- Tải ví dụ JSON ở trang Thiết lập để xem định dạng (hai mẫu minh họa, không phải kết quả đánh giá).
- Chuẩn bị tập kiểm thử độc lập được người hiểu nghiệp vụ gán nhãn, không lấy kết quả AI làm nhãn đúng. Đa dạng các kiểu diễn đạt, thiết bị, trường hợp thiếu và mâu thuẫn. Nhãn không được gửi vào lời nhắc cho mô hình.
- Mỗi lần gọi xử lý ba mẫu; hệ thống chống trùng nội dung và lưu dấu vết theo mô hình/phiên bản hướng dẫn.
- Điều kiện bật: tối thiểu 100 mẫu, tối thiểu 20 mỗi loại hợp lệ/không hợp lệ; ít nhất 80 mẫu thuộc nhóm mô hình đánh giá hợp lệ ở ngưỡng >=0,95, cận dưới Wilson 95% của độ chính xác nhóm này >=0,95. Đây là tiêu chí kiểm chứng kỹ thuật đề xuất cho bản triển khai, không phải yêu cầu con số có sẵn của giảng viên.
- Đạt điều kiện → Ban chủ nhiệm bật tự kiểm tra. Khi gửi/bổ sung đơn, hệ thống đọc mô tả, kiểm tra luật rồi chuyển tiếp nếu đạt. Không đạt → yêu cầu bổ sung trong 24 giờ. Lỗi dịch vụ → giữ đơn ở Chờ kiểm tra và giao người xử lý, không làm mất đơn.
- Đổi mô hình/hướng dẫn → bằng chứng cũ không còn dùng để bật tự động. Cần kiểm thử lại; nếu cờ tự động còn lưu, pipeline vẫn kiểm tra bằng chứng mới trước khi chuyển nhánh.

## Nhắc trả và email

- Bộ xử lý nền kiểm tra quá hạn, trạng thái chưa trả và giới hạn 24 giờ/lượt mượn trước khi tạo lời nhắc. AI chỉ soạn phần lời nhắc; mã thiết bị, số lượng và hạn trả được ghép bằng dữ liệu hệ thống.
- Không có AI hoặc AI lỗi → dùng mẫu cố định, lưu lý do vào hồ sơ.
- Nội dung lưu nội bộ trước. Để chuyển qua email: cấu hình secret `RESEND_API_KEY`, địa chỉ gửi đã được xác minh `MAIL_FROM`, triển khai lại; Ban chủ nhiệm bật tùy chọn gửi email trong Thiết lập.
- Email qua hàng đợi D1; kiểm tra lại trạng thái và người nhận ngay trước khi gửi. Khóa tác vụ ngăn thao tác trả chen giữa bước kiểm tra và gửi; khóa idempotency giúp tránh trùng khi thử lại. Sau 23 giờ chưa xác định được kết quả, chuyển cần kiểm tra thay vì gửi lại mù quáng.
- “Dịch vụ đã tiếp nhận” là nhà cung cấp trả mã email, không khẳng định email đã tới hộp thư. Chưa có webhook báo delivered/bounce và chưa có SMS.
- Không gửi email thật trong quá trình kiểm thử phần mềm nếu chưa có cấu hình và chưa bật tùy chọn.

## Ảnh và biên bản

Tải tối đa bốn ảnh JPEG/PNG, 3 MB/ảnh. Máy chủ kiểm MIME và byte nhận dạng, lưu R2; chỉ chủ không gian đã đăng nhập được xem. Không dùng SVG hoặc URL ảnh công khai.

AI nhận ghi chú, danh sách thiết bị và các ảnh đã tải khi bấm Soạn biên bản. Đầu ra theo JSON Schema; mã hồ sơ, người mượn, thời điểm ghi nhận, mã và số lượng phải trùng dữ liệu nguồn. Người phụ trách kiểm tra, sửa, nhập tên và xác nhận. Đây là xác nhận nghiệp vụ trong demo, không phải chữ ký số pháp lý. AI không xác định khoản tiền bồi thường.

## Tài liệu API

- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://resend.com/docs/api-reference/emails/send-email
