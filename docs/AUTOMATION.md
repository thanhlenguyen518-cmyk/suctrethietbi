# Tác vụ nền của Site Sức Trẻ

Chỉ chạy với Site `appgprj_6ae331dcb3708191b6449f3355c48577` còn ở chế độ chỉ chủ sở hữu. Không tự đổi quyền truy cập. Dừng nếu quyền không còn xác minh được.

Mỗi lượt lấy thông tin Site và service credential hiện tại qua Sites get_site. Không ghi credential vào file, log hoặc lời nhắc tác vụ. Gọi POST `/api/maintenance` tại current_live_url với header `x-suctre-job: maintenance` và service credential theo hướng dẫn Sites; tiếp đó GET cùng endpoint để đọc lại trạng thái. Không cần danh tính khách truy cập, mở trình duyệt hay xuất bản lại. Có script `scripts/run-maintenance.mjs` nhận `{url,token}` qua stdin để thực hiện; token chỉ ở bộ nhớ.

Bộ xử lý cập nhật các mốc 24 giờ bổ sung, 4 giờ nhắc duyệt, quá hạn trả (giới hạn một lần/24 giờ), 7 ngày chưa bồi thường và hàng đợi email đã được chủ bật. Mỗi lượt tối đa ba nhắc quá hạn và ba email/không gian; chạy hàng giờ để xử lý tiếp phần còn lại. Mẫu dự phòng dùng khi AI chưa kết nối; email không gửi nếu chưa bật/cấu hình. Không tự ký nhận, duyệt đơn hay miễn/giảm bồi thường.

Đọc JSON `ok`, `processed`, `emailsAccepted`, `failures` và trường lastJob ở GET. Báo lỗi khi có, không khẳng định email đã tới hộp thư. Tác vụ thông thường không cần báo người dùng trong chat nếu không có lỗi. Không in dữ liệu cá nhân hoặc token.

Service writer dựa vào cơ chế truy cập owner-private của nền tảng. Nếu mở Site công khai hoặc chia sẻ cho người khác sau này, phải tắt `SCHEDULER_ENABLED` và thiết kế lại xác thực/scope của writer trước.
