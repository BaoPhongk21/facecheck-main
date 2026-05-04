# Frontend Design & Architecture

Ứng dụng Frontend được xây dựng nhằm cung cấp hai trải nghiệm chính: Giao diện quản trị (Admin Dashboard) và Màn hình điểm danh (Kiosk Mode).

## 1. Công nghệ sử dụng
- **Core:** React 18+ (hoặc Next.js tùy chọn).
- **Styling:** TailwindCSS / Vanilla CSS kết hợp CSS Modules. Giao diện ưu tiên thiết kế hiện đại (Glassmorphism, Dark mode/Light mode, hiệu ứng mượt mà).
- **State Management:** Zustand (gọn nhẹ, nhanh chóng cho trạng thái toàn cục).
- **Routing:** React Router DOM (v6).
- **Camera API:** Sử dụng HTML5 `getUserMedia` qua thư viện hỗ trợ (ví dụ `react-webcam`) để truy cập webcam.

## 2. Cấu trúc thư mục dự kiến
```text
frontend/
├── public/
│   └── assets/           # Hình ảnh, icon, âm thanh (tiếng tít khi nhận diện)
├── src/
│   ├── api/              # Cấu hình Axios và các hàm gọi API (auth, employee, attendance)
│   ├── assets/           # CSS tổng, font chữ
│   ├── components/       # Các UI Component dùng chung (Button, Modal, Table, Sidebar)
│   ├── config/           # Các biến môi trường, thiết lập hệ thống
│   ├── hooks/            # Custom hooks (vd: useCamera, useAuth)
│   ├── layouts/          # Dashboard Layout, Kiosk Layout
│   ├── pages/            # Các trang chính
│   │   ├── Login/        # Đăng nhập cho Admin
│   │   ├── Dashboard/    # Tổng quan thống kê (số người đi làm, đi muộn...)
│   │   ├── Employees/    # Quản lý nhân viên (Thêm, Sửa, Xóa, Cập nhật khuôn mặt)
│   │   ├── Attendance/   # Lịch sử điểm danh (Báo cáo, lọc theo ngày/tháng)
│   │   └── Kiosk/        # Màn hình điểm danh toàn màn hình cho nhân viên
│   ├── store/            # Zustand stores
│   ├── utils/            # Hàm tiện ích (format ngày tháng, xử lý lỗi)
│   ├── App.jsx
│   └── index.jsx
```

## 3. Chi tiết các module quan trọng

### A. Kiosk Mode (Màn hình Điểm danh)
- Giao diện tràn viền (Full screen), thiết kế thân thiện, có một khung camera lớn ở giữa.
- **Quy trình hoạt động Frontend:**
  1. Yêu cầu quyền truy cập Camera trình duyệt.
  2. Frontend sử dụng `requestAnimationFrame` hoặc `setInterval` để lấy frame ảnh từ video stream (mỗi 1-2 giây một lần) khi phát hiện có chuyển động hoặc liên tục.
  3. Gửi frame ảnh (chuẩn Base64 hoặc Blob) về Backend.
  4. Hiển thị UI loading mờ trên khung hình, chờ phản hồi từ Server.
  5. Khi nhận diện thành công: Hiển thị Popup xanh lá "Xin chào [Tên Nhân Viên], Điểm danh lúc 08:00 AM" và phát âm thanh. Tạm dừng gửi frame 3 giây.
  6. Khi nhận diện thất bại: Popup đỏ "Không nhận diện được, vui lòng thử lại".

### B. Admin Dashboard (Quản trị Nhân sự)
- Yêu cầu đăng nhập.
- **Trang Dashboard:** Biểu đồ hiển thị tình trạng điểm danh trong ngày (Đúng giờ, Đi muộn, Vắng mặt).
- **Trang Quản lý Nhân viên:** 
  - Danh sách nhân viên (Table có phân trang, tìm kiếm).
  - Nút thêm mới: Mở Modal (`AddEmployeeModal`) cho phép điền thông tin (Tên, Mã NV, Phòng ban).
  - Phần quan trọng: Chụp ảnh khuôn mặt lúc thêm mới. Có thể yêu cầu tải lên 1 ảnh rõ mặt hoặc chụp trực tiếp từ webcam để lấy Face Embedding ngay từ đầu.
- **Trang Lịch sử:**
  - Bảng chi tiết mỗi lượt điểm danh (Tên, Mã NV, Thời gian vào/ra, Hình ảnh cắt ra từ camera lúc điểm danh).
  - Tính năng Export ra Excel/CSV để tính lương.

## 4. UI/UX Guidelines
- Giao diện phải mang lại cảm giác "Premium", chuẩn doanh nghiệp.
- Màu sắc chủ đạo: Xanh dương đậm (Trust/Tech) hoặc Xanh ngọc.
- Sử dụng hiệu ứng Skeleton Loading khi tải dữ liệu.
- Phản hồi nhanh (Toast Notification) cho mọi hành động của Admin.
- Nút "Chụp ảnh" (Capture) trong Kiosk cần to, rõ ràng (nếu chọn chế độ bấm chụp), hoặc UI tự động quét thì có vòng cung radar chạy quanh camera.
