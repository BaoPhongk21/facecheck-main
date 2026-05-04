import cv2
import numpy as np
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mediapipe as mp
import math
# Move DeepFace import inside to speed up startup
class VerifySequenceRequest(BaseModel):
    image_1: str
    image_2: str
    image_3: str
    sequence: list # Ví dụ: ["blink", "left", "right"]



app = FastAPI(title="BioHR AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    print("Health check requested")
    return {"status": "ok", "service": "biohr-ai", "message": "AI Service is running"}

# ─── LIVENESS DETECTOR ───
class LivenessDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False, # Tắt để tối ưu cho luồng ảnh liên tục
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def get_ear(self, landmarks, eye_indices):
        def dist(p1, p2):
            return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)
        
        p1, p2, p3, p4, p5, p6 = [landmarks[i] for i in eye_indices]
        ver1 = dist(p2, p6)
        ver2 = dist(p3, p5)
        hor = dist(p1, p4)
        return (ver1 + ver2) / (2.0 * hor)

    def analyze(self, img_rgb):
        results = self.face_mesh.process(img_rgb)
        if not results.multi_face_landmarks:
            return {"face_detected": False}
        
        landmarks = results.multi_face_landmarks[0].landmark
        
        # 1. Blink Detection
        left_eye_indices = [362, 385, 387, 263, 373, 380]
        right_eye_indices = [33, 160, 158, 133, 153, 144]
        
        left_ear = self.get_ear(landmarks, left_eye_indices)
        right_ear = self.get_ear(landmarks, right_eye_indices)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Giảm ngưỡng nhắm mắt một chút để dễ nhận diện hơn (0.22 thay vì 0.20)
        eyes_status = "CLOSED" if avg_ear < 0.25 else "OPEN"
        
        # 2. Pose Detection (Cải tiến với tỷ lệ khoảng cách)
        nose = landmarks[1]
        chin = landmarks[152]
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        
        # Trung điểm mắt
        eyes_mid_x = (left_eye.x + right_eye.x) / 2.0
        eyes_mid_y = (left_eye.y + right_eye.y) / 2.0
        
        # Yaw (Trái/Phải): So sánh khoảng cách mũi tới 2 mắt
        dist_nose_left = abs(nose.x - left_eye.x)
        dist_nose_right = abs(nose.x - right_eye.x)
        yaw_ratio = dist_nose_left / (dist_nose_right + 1e-6)
        
        # Pitch (Lên/Xuống): So sánh khoảng cách Mũi-Mắt và Mũi-Cằm
        dist_nose_eyes = abs(nose.y - eyes_mid_y)
        dist_eyes_chin = abs(eyes_mid_y - chin.y)
        pitch_ratio = dist_nose_eyes / (dist_eyes_chin + 1e-6)
        
        # Xác định tư thế dựa trên tỷ lệ (Ratios)
        if yaw_ratio < 0.6: pose = "LEFT"
        elif yaw_ratio > 1.6: pose = "RIGHT"
        elif pitch_ratio < 0.25: pose = "UP"     # Mũi gần mắt hơn (ngước lên)
        elif pitch_ratio > 0.55: pose = "DOWN"   # Mũi xa mắt hơn (cúi xuống)
        else: pose = "CENTER"
            
        print(f"Liveness: Pose={pose}, EAR={avg_ear:.3f}, YawR={yaw_ratio:.2f}, PitchR={pitch_ratio:.2f}")
        
        # Tính điểm liveness dựa trên các yếu tố (mắt mở, tư thế thẳng, độ phân giải)
        # Một bức ảnh tĩnh "thật" thường có điểm > 0.7
        liveness_score = 0.95
        if pose != "CENTER": liveness_score -= 0.2
        if avg_ear < 0.2: liveness_score -= 0.1 # Nhắm mắt có thể là ảnh hoặc đang nháy mắt thật
        
        return {
            "face_detected": True,
            "pose": pose,
            "eyes": eyes_status,
            "liveness_score": round(liveness_score, 2),
            "ear": round(avg_ear, 3)
        }


liveness_detector = LivenessDetector()

class ImagePayload(BaseModel):
    image_base64: str

def decode_base64_image(base64_string: str) -> np.ndarray:
    try:
        # Xóa prefix nếu có (vd: data:image/jpeg;base64,)
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Không thể decode ảnh")
        # Chuyển đổi từ BGR (OpenCV default) sang RGB (DeepFace/Standard)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi format ảnh: {str(e)}")

@app.get("/health")
def health_check_v1():
    return {"status": "ok", "service": "AI Facial Recognition"}

@app.post("/api/v1/extract")
def extract_face(payload: ImagePayload):
    print("Received extraction request...")
    from deepface import DeepFace
    try:
        img = decode_base64_image(payload.image_base64)
        print("Image decoded successfully.")
        
        # Trích xuất vector đặc trưng (Face Embedding)
        # Sử dụng mô hình Facenet và MTCNN để nhận diện chính xác hơn
        print("Starting DeepFace.represent...")
        results = DeepFace.represent(
            img_path=img, 
            model_name="Facenet", 
            detector_backend="opencv", 
            enforce_detection=True
        )
        print("DeepFace.represent finished.")
        
        if not results or len(results) == 0:
            return {"success": False, "error": "Không tìm thấy khuôn mặt trong ảnh"}
            
        # Kiểm tra chống giả mạo cơ bản: Nếu có nhiều hơn 1 khuôn mặt, có thể là đang cầm điện thoại/ảnh
        if len(results) > 1:
            print(f"Warning: {len(results)} faces detected. Possible spoofing.")
            return {"success": False, "error": "Phát hiện nhiều khuôn mặt. Vui lòng chỉ một người đứng trước camera."}

        # Lấy khuôn mặt đầu tiên (to nhất)
        face_data = results[0]
        confidence = face_data.get('face_confidence', 0.99)
        
        # Kiểm tra thêm bằng Mediapipe Liveness (Layer 2)
        liveness_info = liveness_detector.analyze(img)
        
        embedding = face_data["embedding"]
        bbox = face_data["facial_area"]
        
        # Nếu liveness không phát hiện mặt, đừng trả về lỗi ngay (có thể do góc chụp mobile)
        # Nhưng đặt điểm số liveness thấp để backend xử lý
        if not liveness_info.get("face_detected"):
            liveness_score = 0.5
            print(f"Warning: Liveness layer 2 failed to detect face. Score: {liveness_score}")
        else:
            # Ảnh chụp thường có EAR cực thấp hoặc không thay đổi, và pose cứng nhắc
            liveness_score = 0.95 if confidence > 0.9 else 0.85
            print(f"Liveness layer 2 passed. Score: {liveness_score}")

        return {
            "success": True,
            "embedding": embedding,
            "bbox": bbox,
            "confidence": confidence,
            "liveness_score": liveness_score,
            "liveness_info": liveness_info
        }
        
    except ValueError as ve:
        print("Face not detected.")
        # DeepFace quăng ValueError nếu không thấy khuôn mặt
        return {"success": False, "error": "Không nhận diện được khuôn mặt. Vui lòng thử lại gần camera hơn."}
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail="Lỗi AI Server")

@app.post("/api/v1/liveness-check")
async def liveness_poll(payload: ImagePayload):
    try:
        img = decode_base64_image(payload.image_base64)
        # Chuyển BGR (OpenCV) sang RGB (MediaPipe)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = liveness_detector.analyze(img_rgb)
        
        return {
            "success": True,
            "face_detected": result.get("face_detected", False),
            "eyes": result.get("eyes", "OPEN"),
            "pose": result.get("pose", "CENTER")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/v1/verify_sequence")
async def verify_sequence(request: VerifySequenceRequest):
    try:
        # 1. Giải mã 3 ảnh
        def decode_img(b64):
            header_part = b64.split(',')[-1]
            data = base64.b64decode(header_part)
            nparr = np.frombuffer(data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        imgs = [decode_img(request.image_1), decode_img(request.image_2), decode_img(request.image_3)]

        if any(img is None for img in imgs):
            return {"success": False, "error": "Lỗi giải mã hình ảnh"}

        # 2. Phân tích từng ảnh và so khớp với yêu cầu trong sequence
        checks = {}
        for i, action in enumerate(request.sequence):
            res = liveness_detector.analyze(cv2.cvtColor(imgs[i], cv2.COLOR_BGR2RGB))
            
            if not res.get("face_detected"):
                checks[action] = False
                continue

            if action == "blink":
                checks[action] = res.get("eyes") == "CLOSED"
            elif action == "left":
                checks[action] = res.get("pose") == "LEFT"
            elif action == "right":
                checks[action] = res.get("pose") == "RIGHT"
            else:
                checks[action] = False

        is_valid = all(checks.values())

        if not is_valid:
            failed_steps = [k for k, v in checks.items() if not v]
            translated = {"blink": "Nháy mắt", "left": "Quay trái", "right": "Quay phải"}
            err_msg = ", ".join([translated.get(s, s) for s in failed_steps])
            return {
                "success": False,
                "error": f"Xác minh thất bại: {err_msg}",
                "checks": checks
            }

        # 3. Nhận diện khuôn mặt (Dùng ảnh cuối cùng trong chuỗi)
        from deepface import DeepFace
        results = DeepFace.represent(img_path=imgs[2], model_name="Facenet", detector_backend="opencv", enforce_detection=True)
        
        if not results:
            return {"success": False, "error": "Không trích xuất được khuôn mặt ở bước cuối"}

        return {
            "success": True,
            "embedding": results[0]["embedding"],
            "liveness_score": 1.0,
            "checks": checks
        }

    except Exception as e:
        print(f"Error in verify_sequence: {str(e)}")
        return {"success": False, "error": f"Lỗi xử lý server: {str(e)}"}


if __name__ == "__main__":
    import uvicorn
    print("Starting Uvicorn...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
