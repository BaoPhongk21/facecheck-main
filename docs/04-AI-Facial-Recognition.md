# AI Facial Recognition Service

Thành phần AI là cốt lõi của hệ thống, chịu trách nhiệm nhận diện và phân tích dữ liệu sinh trắc học từ khuôn mặt. Microservice này được viết bằng Python.

## 1. Công nghệ sử dụng
- **Framework API:** FastAPI (Rất nhanh, hỗ trợ async tốt, có sẵn Swagger Docs).
- **Core AI/Computer Vision:**
  - OpenCV: Xử lý tiền xử lý ảnh (cắt, xoay, chỉnh sáng, chuyển đổi định dạng).
  - Thư viện nhận diện: **InsightFace** (đề xuất, vì độ chính xác rất cao trên mặt người Châu Á) hoặc **FaceNet** (PyTorch/TensorFlow). Dùng mô hình như `ArcFace`.
  - Nhận diện vật thể / Phát hiện khuôn mặt (Face Detection): MTCNN hoặc RetinaFace (để tìm ra ô vuông chứa khuôn mặt trong bức ảnh trước).
- **So khớp Vector (Vector Search):**
  - Sử dụng thư viện `Faiss` (của Facebook) để so khớp các face embeddings nhanh chóng, hoặc tính Cosine Similarity / Euclidean Distance bằng NumPy/SciPy.

## 2. Các bước xử lý của thuật toán

**Bước 1: Face Detection (Phát hiện khuôn mặt)**
- Đầu vào: Ảnh chụp toàn cảnh từ Camera Kiosk.
- Quá trình: Dùng RetinaFace quét ảnh, tìm kiếm tọa độ (Bounding box) của khuôn mặt. Loại bỏ những khuôn mặt quá nhỏ hoặc nằm rìa ảnh.
- Kết quả: Ảnh đã được cắt gọt (crop) và căn chỉnh (alignment - chỉnh cho 2 mắt nằm ngang nhau) chỉ chứa đúng khuôn mặt.

**Bước 2: Feature Extraction (Trích xuất đặc trưng - Face Embedding)**
- Đầu vào: Ảnh khuôn mặt đã được crop.
- Quá trình: Đưa ảnh qua mạng Neural Network (VD: ArcFace model).
- Kết quả: Mạng nhả ra một Vector đặc trưng (Ví dụ mảng gồm 512 số thực: `[0.12, -0.45, 0.88, ...]`). Vector này là "vân tay" của khuôn mặt.

**Bước 3: Face Matching (So khớp khuôn mặt)**
- Trong lúc đăng ký mới: Vector 512 chiều được trả về cho Backend để lưu vào Database.
- Trong lúc nhận diện:
  - Vector mới chụp được lấy ra tính toán khoảng cách (Cosine Similarity) với toàn bộ Vector hiện có trong cơ sở dữ liệu.
  - Nếu khoảng cách với Vector A nhỏ hơn một ngưỡng Threshold (ví dụ: Độ tương đồng > 85%) thì xác định người đó là Nhân viên A.
  - Nếu độ tương đồng cao nhất vẫn < 85%, kết luận người lạ (Unknown).

## 3. Cấu trúc thư mục dự kiến
```text
ai-service/
├── app/
│   ├── api/            # FastAPI endpoints (routes)
│   │   ├── routes.py
│   ├── core/           # Cấu hình, Threshold settings
│   ├── models/         # Các mô hình AI đã tải về (weights/ .pth / .onnx)
│   ├── services/       # Logic AI lõi
│   │   ├── detection.py # Chức năng cắt mặt
│   │   ├── embedding.py # Chức năng tạo vector 512d
│   │   └── matching.py  # Chức năng so khớp với Faiss hoặc Cosine
│   ├── utils/          # Chuyển đổi định dạng ảnh (Base64 <-> cv2 image)
│   └── main.py         # Khởi tạo FastAPI
├── requirements.txt    # Các thư viện python (fastapi, uvicorn, opencv-python, insightface...)
└── Dockerfile          # Đóng gói service
```

## 4. Các Endpoints API của AI Service
- `POST /api/v1/extract-embedding`: 
  - Input: Hình ảnh (Upload hoặc Base64).
  - Output: `{"success": true, "embedding": [0.12, ...], "bbox": [x1, y1, x2, y2]}`
- `POST /api/v1/recognize`:
  - Input: Hình ảnh cần nhận diện + Danh sách các Vector trong DB (hoặc AI service tự query DB).
  - Output: `{"success": true, "match_id": "EMP001", "confidence": 0.92}`

## 5. Tối ưu & Nâng cao (Anti-Spoofing - Tùy chọn)
- Liveness Detection: Để tránh việc người dùng cầm ảnh hoặc màn hình điện thoại đưa trước camera để điểm danh hộ, AI có thể cần tích hợp mô hình Liveness Detection (nhận diện nháy mắt, cử động, hoặc đo chiều sâu mảng sáng).
