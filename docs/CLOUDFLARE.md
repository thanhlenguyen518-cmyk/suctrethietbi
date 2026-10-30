# Cloudflare độc lập — bản demo học phần
Build command: `pnpm run build:cloudflare`
Deploy command: `pnpm run deploy:cloudflare`
Tắt Preview builds; không bật Cloudflare Access.
Sau khi deploy: tạo D1, chạy docs/CLOUDFLARE_SCHEMA.sql trong Console; gắn D1 vào Worker với tên DB. Tạo bucket R2 và gắn với tên BUCKET (chỉ cần khi tải ảnh). Redeploy sau khi thêm bindings.
Bản này tạo phiên demo riêng theo cookie trình duyệt, không yêu cầu ChatGPT. Chuyển vai trò là mô phỏng, không phải tài khoản phân quyền thực tế. Không nhập dữ liệu cá nhân thật. Endpoint maintenance bị khóa trên bản public. Dữ liệu hiện có trên Sites không tự chuyển sang D1 mới.
AI và email chưa được cấu hình tự động. Không thêm khóa API vào GitHub. Chưa nên bật dịch vụ trả phí trên bản demo công khai trước khi có kiểm soát truy cập/hạn mức phù hợp.
