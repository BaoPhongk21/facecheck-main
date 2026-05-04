# BioHR (Facecheck) 👁️✨
*Hệ thống Quản lý Nhân sự & Chấm công bằng Trí tuệ Nhân tạo (AI Facial Recognition)*

![BioHR Hero](frontend/src/assets/hero.png) *(Nếu có ảnh minh họa, đặt tại đây)*

**BioHR** là một giải pháp quản lý nhân sự toàn diện, được thiết kế chuyên biệt cho doanh nghiệp hiện đại. Ứng dụng nổi bật với khả năng **chấm công tự động bằng nhận diện khuôn mặt (AI Facial Recognition)**, tự động tính lương, phân ca làm việc, và tích hợp cổng thông tin nội bộ (Portal) riêng biệt cho từng vai trò (Quản trị viên & Nhân viên).

---

## 🌟 Các tính năng nổi bật

### 1. Dành cho Quản trị viên (HR / Admin)
- **AI Kiosk Chấm công:** Quản lý màn hình Camera (Kiosk) nhận diện khuôn mặt nhân viên thời gian thực.
- **Quản lý Nhân sự:** Thêm, sửa, xóa, và theo dõi hồ sơ của toàn bộ nhân viên.
- **Phân ca làm việc:** Định nghĩa ca sáng/chiều/tối, thiết lập thời gian cho phép đi trễ.
- **Xét duyệt Nghỉ phép:** Duyệt hoặc từ chối đơn xin nghỉ của nhân viên với 1 click.
- **Tính lương Tự động:** Tính lương dựa trên số giờ làm thực tế, giờ OT, trừ đi trễ và xuất ra file Excel.
- **Gửi Thông báo:** Gửi các thông báo quan trọng đến toàn bộ nhân viên trong công ty.

### 2. Dành cho Nhân viên (Employee Portal) & Mobile App
- **Bảng tin Cá nhân (Dashboard):** Xem ngay thống kê số ngày đi làm, đi trễ, và giờ check-in/out hôm nay.
- **Chấm công Mobile (Kiosk Mode):** Biến máy tính bảng hoặc điện thoại thành máy chấm công nhận diện khuôn mặt chuyên nghiệp.
- **Hỗ trợ Offline:** Lưu trữ dữ liệu chấm công cục bộ bằng SQLite khi mất kết nối và tự động đồng bộ khi có mạng.
- **Quản lý Sinh trắc học:** Tự cập nhật khuôn mặt của mình thông qua webcam máy tính hoặc camera điện thoại.
- **Nghỉ phép & Phiếu lương:** Chủ động tạo đơn xin nghỉ phép và xem chi tiết lương thưởng ngay trên thiết bị di động.

---

## ⚙️ Kiến trúc Hệ thống (Tech Stack)

Dự án được xây dựng theo kiến trúc Microservices gồm 3 thành phần chính:

- **Frontend (Web):** `React.js`, `Vite`, `Tailwind CSS`, `Zustand`.
- **Backend (API):** `Node.js`, `Express.js`, `Prisma ORM`, `PostgreSQL`, `Socket.io`.
- **Mobile (App):** `React Native`, `Expo`, `SQLite` (Lưu trữ offline).
- **AI Service:** `Python`, `FastAPI`, `DeepFace` / `Face_recognition`.

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án

### 1. Yêu cầu hệ thống (Prerequisites)
- [Node.js](https://nodejs.org/) (Phiên bản 18+).
- [Python](https://www.python.org/) (Phiên bản 3.10+).
- [PostgreSQL](https://www.postgresql.org/) (Đang chạy ở cổng mặc định 5432).

### 2. Cài đặt Backend (Node.js)
Mở terminal và trỏ vào thư mục `backend`:
```bash
cd backend
npm install
```
- Tạo file `.env` và thiết lập biến môi trường (Tham khảo `DATABASE_URL` và `JWT_SECRET`).
- Chạy lệnh để đồng bộ cơ sở dữ liệu:
```bash
npx prisma db push
```
- Chạy server (Cổng mặc định: `5000`):
```bash
npm run dev
```

### 3. Cài đặt AI Service (Python)
Mở một terminal khác và trỏ vào thư mục `ai-service`:
```bash
cd ai-service
# Khởi tạo môi trường ảo (Khuyên dùng)
python -m venv venv
venv\Scripts\activate  # (Windows)
# source venv/bin/activate # (Mac/Linux)

pip install -r requirements.txt
```
- Chạy AI API Server (Cổng mặc định: `8000`):

```bash
.\venv\Scripts\activate
python main.py
```

### 4. Cài đặt Frontend (React)
Mở terminal thứ 3 và trỏ vào thư mục `frontend`:
```bash
cd frontend
npm install
npm run dev
```
- Giao diện web sẽ chạy tại: `http://localhost:5173`

### 5. Cài đặt Mobile App (Expo)
Mở terminal thứ 4 và trỏ vào thư mục `mobile`:
```bash
cd mobile
npm install
npm start
```
- Sử dụng ứng dụng **Expo Go** (trên iOS/Android) để quét mã QR và trải nghiệm.
- Để chạy giả lập: Nhấn `a` cho Android hoặc `i` cho iOS.

---

## 🔐 Thông tin Đăng nhập Mặc định

*Hệ thống sử dụng chung một cổng đăng nhập (`/login`). Giao diện sẽ tự động chuyển đổi tùy theo vai trò.*

- **Tài khoản Admin:**
  - Username: `admin`
  - Password: `admin123`

- **Tài khoản Nhân viên (Ví dụ):**
  - Username: `(Mã nhân viên, VD: 4920)`
  - Password: `123456` (Mặc định)

---

## 🌐 Chia sẻ qua Internet (Public Tunnel)
Nếu bạn muốn chia sẻ ứng dụng Mobile cho người ở xa hoặc dùng qua 4G/khác mạng Wi-Fi, chỉ cần chạy **duy nhất 1 lệnh** tại thư mục `mobile`:

```bash
cd mobile
npm run share
```

*Lưu ý: Lệnh này sử dụng **Cloudflare Tunnel** để tự động tạo đường hầm bảo mật. Script sẽ tự động lấy URL mới và cập nhật cấu hình API cho App Mobile. Bạn chỉ cần quét mã QR và bắt đầu sử dụng, không cần chỉnh sửa bất kỳ file nào.*

---
## 💡 Ghi chú dành cho nhà phát triển
- Ứng dụng yêu cầu cấp quyền Camera trên trình duyệt để sử dụng tính năng **Đăng ký khuôn mặt** (ở trang Hồ sơ) và **AI Kiosk**.
- Database được quản lý bằng Prisma, mọi thay đổi cấu trúc bảng cần chỉnh sửa trong `backend/prisma/schema.prisma` và chạy lại `npx prisma db push`.

---
*Dự án phát triển bởi Nguyễn Hoàng Thông.*
