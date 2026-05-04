# Backend API & Business Logic

Backend đóng vai trò xử lý nghiệp vụ, quản lý dữ liệu, xác thực và là trạm trung chuyển (Gateway) giao tiếp với AI Service.

## 1. Công nghệ sử dụng
- **Ngôn ngữ/Framework:** Node.js, Express.js.
- **ORM / Query Builder:** Prisma hoặc Sequelize (để giao tiếp với PostgreSQL).
- **Upload File:** Multer (để nhận hình ảnh tải lên hoặc Base64).
- **Xác thực:** JWT (JSON Web Tokens) cho Admin.
- **Giao tiếp với AI Service:** Axios.

## 2. Cấu trúc thư mục dự kiến
```text
backend/
├── src/
│   ├── config/          # Cấu hình DB, môi trường, Axios instance gọi sang AI
│   ├── controllers/     # Xử lý logic Request/Response
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   └── attendanceController.js
│   ├── middlewares/     # Middleware xác thực JWT, xử lý file upload, xử lý lỗi
│   ├── models/          # Schema / Models định nghĩa database
│   ├── routes/          # Khai báo các endpoints API
│   │   ├── authRoutes.js
│   │   ├── employeeRoutes.js
│   │   └── attendanceRoutes.js
│   ├── services/        # Logic nghiệp vụ gọi qua AI hoặc DB phức tạp
│   │   └── aiService.js # Hàm wrap các lời gọi sang FastAPI (extract, verify)
│   ├── utils/           # Tiện ích (logger, helper)
│   └── app.js           # Khởi tạo Express app
├── package.json
└── .env
```

## 3. Các REST API chính

### A. Nhóm API Xác thực (Auth)
- `POST /api/auth/login`: Admin đăng nhập, trả về JWT Token.
- `GET /api/auth/me`: Lấy thông tin Admin hiện tại.

### B. Nhóm API Nhân viên (Employees)
- `GET /api/employees`: Lấy danh sách nhân viên (có phân trang, tìm kiếm).
- `GET /api/employees/:id`: Lấy chi tiết 1 nhân viên.
- `POST /api/employees`: 
  - Nhận thông tin (Tên, Mã NV, Phòng ban) kèm 1 tệp ảnh.
  - *Logic:* Gọi AI Service `/extract` -> nhận chuỗi vector. Lưu thông tin NV + vector vào DB. Trả về kết quả.
- `PUT /api/employees/:id`: Cập nhật thông tin nhân viên.
- `DELETE /api/employees/:id`: Xóa nhân viên.
- `POST /api/employees/:id/update-face`: Cập nhật lại khuôn mặt cho nhân viên.

### C. Nhóm API Điểm danh (Attendance)
- `POST /api/attendance/recognize`: 
  - API phục vụ cho màn hình Kiosk. Nhận vào dữ liệu ảnh chụp từ webcam.
  - *Logic:* 
    1. Gửi ảnh sang AI Service `/identify` kèm với bộ dữ liệu đặc trưng của toàn bộ công ty (nếu AI không kết nối thẳng DB). Hoặc nếu AI kết nối trực tiếp DB, chỉ cần truyền ảnh.
    2. AI trả về ID nhân viên (hoặc báo Unknown).
    3. Nếu có ID, Backend lấy thông tin NV, lưu một record vào bảng `attendance_logs` với thời gian hiện tại.
    4. Trả về thông tin NV (Tên, Ảnh đại diện, Thời gian) để Kiosk hiển thị thành công.
- `GET /api/attendance/logs`: Lấy danh sách lịch sử điểm danh (cho Admin), hỗ trợ lọc theo ngày, tháng, nhân viên.

## 4. Các điểm cần lưu ý
- **Xử lý đồng thời (Concurrency):** Vào giờ cao điểm (sáng 8h), nhiều nhân viên điểm danh cùng lúc. API `/recognize` phải được tối ưu, xử lý nhanh chóng.
- **Bảo mật ảnh:** Ảnh chụp từ camera có thể không cần lưu trữ vĩnh viễn (để tiết kiệm ổ cứng), chỉ lưu lại log điểm danh (text) và ID, hoặc lưu 1 thumbnail nhỏ làm bằng chứng.
- **Kiểm soát lỗi:** Khi AI Service bị sập hoặc quá tải, Backend cần có cơ chế Fallback (VD: Báo lỗi "Hệ thống AI đang bảo trì" về cho Kiosk một cách rõ ràng).
