# Kiến trúc tổng thể Hệ thống Điểm danh bằng Khuôn mặt (HR AI Attendance)

Tài liệu này mô tả kiến trúc tổng thể của hệ thống điểm danh bằng nhận diện khuôn mặt. Hệ thống được chia thành 4 thành phần chính hoạt động phối hợp với nhau.

## 1. Các thành phần chính (Components)

1. **Frontend (Ứng dụng Web / Giao diện người dùng)**
   - **Công nghệ:** React.js, Tailwind CSS (hoặc CSS thuần theo yêu cầu), Zustand/Redux (Quản lý trạng thái), Axios.
   - **Nhiệm vụ:**
     - Giao diện Admin để quản lý nhân viên, xem báo cáo điểm danh.
     - Màn hình Camera điểm danh (Kiosk mode) hiển thị luồng video realtime từ webcam.
     - Cung cấp trải nghiệm người dùng (UX) hiện đại, phản hồi nhanh chóng khi nhân viên thực hiện điểm danh.

2. **Backend (API Server / Xử lý nghiệp vụ lõi)**
   - **Công nghệ:** Node.js, Express.js.
   - **Nhiệm vụ:**
     - Cung cấp RESTful API cho Frontend (Xác thực, Quản lý Nhân sự, Quản lý Lịch sử Điểm danh).
     - Đóng vai trò là cầu nối (Gateway) giữa Frontend và AI Service. Khi frontend gửi ảnh điểm danh, Backend sẽ nhận, có thể lưu trữ tạm, sau đó gọi sang AI Service để nhận diện, rồi lưu kết quả vào Database.
     - Kết nối và tương tác với Database.

3. **AI Service (Microservice Nhận diện Khuôn mặt)**
   - **Công nghệ:** Python, FastAPI, OpenCV, InsightFace / FaceNet, PyTorch/TensorFlow.
   - **Nhiệm vụ:**
     - Cung cấp API nhận diện (chỉ nhận và xử lý ảnh).
     - Trích xuất đặc trưng khuôn mặt (Face Embeddings) từ ảnh đầu vào khi đăng ký nhân viên mới.
     - So khớp đặc trưng khuôn mặt (Face Matching) từ ảnh điểm danh với tập dữ liệu vector đã được lưu trữ (sử dụng faiss hoặc tính toán khoảng cách cosine/euclid) để xác định danh tính.

4. **Database (Lưu trữ Dữ liệu)**
   - **Công nghệ:** PostgreSQL (Lưu trữ dữ liệu có cấu trúc), pgvector (nếu lưu trữ vector trực tiếp trong database) hoặc Redis (cho caching và rate limiting).
   - **Nhiệm vụ:**
     - Lưu trữ thông tin nhân viên, phòng ban.
     - Lưu trữ log lịch sử điểm danh (thời gian, hình ảnh chụp lúc điểm danh, trạng thái hợp lệ).
     - Lưu trữ Face Embeddings của nhân viên.

## 2. Luồng hoạt động (Workflows)

### Luồng Đăng ký Nhân viên (Enrollment)
1. Admin mở Frontend, thêm thông tin nhân viên và tải lên ảnh khuôn mặt (hoặc chụp trực tiếp từ webcam).
2. Frontend gửi request tạo nhân viên kèm hình ảnh tới Backend.
3. Backend gọi API `/extract-embedding` của AI Service, truyền bức ảnh sang.
4. AI Service phân tích ảnh, tìm khuôn mặt và tạo ra một vector (embedding) ví dụ độ dài 512, trả về cho Backend.
5. Backend lưu thông tin nhân viên cùng chuỗi embedding này vào Database. Trả về thành công cho Frontend.

### Luồng Điểm danh (Attendance)
1. Nhân viên đứng trước camera ở giao diện Kiosk của Frontend. Frontend tự động chụp ảnh hoặc quay một đoạn video ngắn và gửi lên Backend.
2. Backend gửi ảnh vừa chụp sang AI Service (API `/verify` hoặc `/identify`).
3. (Tùy chọn kiến trúc) AI Service có thể lấy toàn bộ vector embedding từ Database hoặc Backend gửi kèm danh sách vector, để AI Service tìm ra người giống nhất.
4. AI Service trả về ID của nhân viên (nếu độ chính xác > ngưỡng threshold) hoặc báo không nhận diện được (Unknown).
5. Backend nhận ID, kiểm tra giờ giấc (có đi trễ không), ghi một bản ghi vào bảng `attendance_logs` trong Database.
6. Backend trả về thông báo "Điểm danh thành công, Xin chào [Tên]" cho Frontend. Frontend hiển thị thông báo và phát âm thanh.

## 3. Lợi ích của Kiến trúc này
- **Tách biệt mối quan tâm (Separation of Concerns):** AI nặng về tính toán (GPU/CPU) được tách riêng ở Python, dễ dàng mở rộng (scale) độc lập. Backend Node.js xử lý I/O bất đồng bộ cực tốt cho nghiệp vụ và database.
- **Dễ dàng bảo trì và nâng cấp:** Nếu sau này có thuật toán AI mới, chỉ cần cập nhật AI Service mà không ảnh hưởng tới Backend hay Frontend.
- **Hiệu năng cao:** Frontend tương tác mượt mà qua API, luồng xử lý AI được tối ưu riêng biệt.
