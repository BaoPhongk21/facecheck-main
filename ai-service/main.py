import cv2
import numpy as np
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mediapipe as mp
import math

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
            static_image_mode=True, # Dùng cho ảnh tĩnh đơn lẻ
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
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
        
        eyes_status = "CLOSED" if avg_ear < 0.22 else "OPEN" # Nới lỏng từ 0.20 lên 0.22
        
        # 2. Pose Detection
        nose = landmarks[1]
        chin = landmarks[152]
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        
        eyes_mid_x = (left_eye.x + right_eye.x) / 2.0
        eyes_mid_y = (left_eye.y + right_eye.y) / 2.0
        
        dist_nose_left = abs(nose.x - left_eye.x)
        dist_nose_right = abs(nose.x - right_eye.x)
        yaw_ratio = dist_nose_left / (dist_nose_right + 1e-6)
        
        dist_nose_eyes = abs(nose.y - eyes_mid_y)
        dist_eyes_chin = abs(eyes_mid_y - chin.y)
        pitch_ratio = dist_nose_eyes / (dist_eyes_chin + 1e-6)
        
        if yaw_ratio < 0.75: pose = "LEFT" # Nới lỏng từ 0.6
        elif yaw_ratio > 1.35: pose = "RIGHT" # Nới lỏng từ 1.6
        elif pitch_ratio < 0.35: pose = "UP" # Nới lỏng từ 0.25
        elif pitch_ratio > 0.45: pose = "DOWN" # Nới lỏng từ 0.55
        else: pose = "CENTER"
            
        return {
            "face_detected": True,
            "pose": pose,
            "eyes": eyes_status,
            "ear": round(avg_ear, 3),
            "yaw_ratio": round(yaw_ratio, 2),
            "pitch_ratio": round(pitch_ratio, 2)
        }

liveness_detector = LivenessDetector()

class ImagePayload(BaseModel):
    image_base64: str

def decode_base64_image(base64_string: str) -> np.ndarray:
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Không thể decode ảnh")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi format ảnh: {str(e)}")

@app.post("/api/v1/extract")
def extract_face(payload: ImagePayload):
    from deepface import DeepFace
    try:
        img = decode_base64_image(payload.image_base64)
        
        # 1. Trích xuất vector đặc trưng
        try:
            results = DeepFace.represent(
                img_path=img, 
                model_name="Facenet", 
                detector_backend="mediapipe",
                enforce_detection=True
            )
        except Exception:
            # Nếu không tìm thấy mặt, thử lật ảnh lại (nhiều camera bị ngược)
            img_flipped = cv2.flip(img, 1)
            results = DeepFace.represent(
                img_path=img_flipped, 
                model_name="Facenet", 
                detector_backend="mediapipe",
                enforce_detection=True
            )
        
        if not results or len(results) == 0:
            return {"success": False, "error": "Không tìm thấy khuôn mặt trong ảnh"}
            
        if len(results) > 1:
            return {"success": False, "error": "Phát hiện nhiều khuôn mặt. Vui lòng chỉ một người đứng trước camera."}

        face_data = results[0]
        confidence = face_data.get('face_confidence', 0.99)
        
        # 2. Layer 2: Liveness Check bằng Mediapipe
        liveness_info = liveness_detector.analyze(img)
        
        # 3. Tính toán điểm Liveness thực tế
        if not liveness_info.get("face_detected"):
            liveness_score = 0.3
        else:
            # Kết hợp điểm tin cậy DeepFace và kiểm tra EAR của Mediapipe
            # liveness_score lý tưởng từ 0.7 đến 0.99
            base_score = (confidence * 0.5) + 0.45
            
            # Kiểm tra chỉ số EAR (Eye Aspect Ratio) tự nhiên (0.15 - 0.45)
            ear = liveness_info.get("ear", 0)
            if ear < 0.12 or ear > 0.50:
                # Nếu mắt quá nhỏ (nhắm) hoặc quá to (màn hình lóa), giảm điểm nhẹ
                base_score -= 0.10
            
            liveness_score = max(0.1, min(0.99, base_score))

        return {
            "success": True,
            "embedding": face_data["embedding"],
            "bbox": face_data["facial_area"],
            "confidence": confidence,
            "liveness_score": liveness_score,
            "liveness_info": liveness_info
        }
        
    except ValueError:
        return {"success": False, "error": "Không nhận diện được khuôn mặt. Vui lòng thử lại gần camera hơn."}
    except Exception as e:
        print("AI Server Error:", e)
        raise HTTPException(status_code=500, detail="Lỗi xử lý AI")

@app.post("/api/v1/liveness-check")
def liveness_check(payload: ImagePayload):
    try:
        img = decode_base64_image(payload.image_base64)
        result = liveness_detector.analyze(img)
        return result
    except Exception as e:
        return {"face_detected": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
