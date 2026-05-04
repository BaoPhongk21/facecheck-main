# Database Schema (PostgreSQL)

Hệ thống sử dụng PostgreSQL vì đây là RDBMS mạnh mẽ, ổn định và có extension `pgvector` rất hữu ích nếu muốn lưu trữ và so khớp Face Embeddings trực tiếp trong database.

## 1. Extension yêu cầu (Khuyến nghị)
Sử dụng extension `vector` cho PostgreSQL để lưu và query embedding.
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 2. Thiết kế các bảng chính

### Bảng `departments` (Phòng ban)
Lưu thông tin các phòng ban trong công ty.
- `id` (UUID / Serial, PK)
- `name` (Varchar, Ví dụ: "Phòng Kỹ thuật", "Phòng Nhân sự")
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Bảng `employees` (Nhân viên)
Lưu trữ thông tin cá nhân và đặc trưng khuôn mặt của nhân viên.
- `id` (UUID / Serial, PK)
- `employee_code` (Varchar, Unique - Mã NV ví dụ: "NV001")
- `full_name` (Varchar)
- `email` (Varchar, Unique, Optional)
- `phone` (Varchar, Optional)
- `department_id` (FK tham chiếu `departments.id`)
- `avatar_url` (Varchar - Link ảnh đại diện hoặc ảnh gốc chụp khi đăng ký)
- `face_embedding` (Kiểu dữ liệu `vector(512)` nếu dùng pgvector, hoặc lưu dạng JSONB / Text array chứa mảng 512 số thực).
- `is_active` (Boolean, Default: True)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Bảng `attendance_logs` (Lịch sử điểm danh)
Ghi nhận mỗi lần nhận diện thành công tại Kiosk.
- `id` (UUID / Serial, PK)
- `employee_id` (FK tham chiếu `employees.id`)
- `check_time` (Timestamp - Thời gian điểm danh, vd: `2024-05-12 08:05:00`)
- `type` (Enum: 'IN', 'OUT' - Loại điểm danh, có thể hệ thống tự động suy luận dựa trên lượt điểm danh đầu và cuối trong ngày).
- `status` (Enum: 'ON_TIME', 'LATE' - Trạng thái đi làm đúng giờ hay muộn).
- `snapshot_url` (Varchar, Optional - Link ảnh thu nhỏ chụp khoảnh khắc điểm danh thành công làm bằng chứng).
- `confidence_score` (Float - Điểm tự tin của AI khi nhận diện thành công, ví dụ 0.95).
- `created_at` (Timestamp)

### Bảng `admins` (Tài khoản quản trị)
Lưu thông tin đăng nhập của người quản lý.
- `id` (UUID / Serial, PK)
- `username` (Varchar, Unique)
- `password_hash` (Varchar - Lưu mật khẩu đã mã hóa bcrypt)
- `role` (Enum: 'SUPER_ADMIN', 'HR')
- `created_at` (Timestamp)

## 3. Chiến lược So khớp Vector với Database
Có 2 cách triển khai với Database:

**Cách 1: Tính toán tại AI Service (In-Memory / Faiss) - Khuyến nghị cho tập dữ liệu < 100,000 người**
- Khi AI service khởi động (hoặc khi có nhân viên mới), AI service gọi Backend/DB để load toàn bộ ID và mảng `face_embedding` lưu vào RAM bằng thư viện `Faiss`.
- Khi điểm danh, ảnh đưa vào mạng lưới ra vector -> Search trên RAM Faiss cực nhanh.

**Cách 2: Tính toán tại Database dùng pgvector (Cho hệ thống lớn và thay đổi thường xuyên)**
- API điểm danh gọi sang AI để trích vector ảnh hiện tại -> trả về `query_vector`.
- Backend gọi câu lệnh SQL trực tiếp trên DB để tìm kiếm:
```sql
SELECT employee_id, full_name, 1 - (face_embedding <=> '[0.12, 0.45, ...]') as similarity
FROM employees
ORDER BY face_embedding <=> '[0.12, 0.45, ...]'
LIMIT 1;
```
- Cách này DB tự động tính Cosine Distance (Toán tử `<=>`) và trả về kết quả gần nhất, AI service hoàn toàn phi trạng thái (Stateless).
