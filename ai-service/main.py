import cv2
import numpy as np
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deepface import DeepFace

app = FastAPI(title="BioHR AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "biohr-ai", "message": "AI Service is running"}

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
    print("📥 Received extraction request...")
    try:
        img = decode_base64_image(payload.image_base64)
        print("🖼️ Image decoded successfully.")
        
        # Trích xuất vector đặc trưng (Face Embedding)
        # Sử dụng mô hình Facenet và MTCNN để nhận diện chính xác hơn
        results = DeepFace.represent(
            img_path=img, 
            model_name="Facenet", 
            detector_backend="opencv", 
            enforce_detection=True
        )
        
        if not results or len(results) == 0:
            return {"success": False, "error": "Không tìm thấy khuôn mặt trong ảnh"}
            
        # Lấy khuôn mặt đầu tiên (to nhất)
        face_data = results[0]
            
        embedding = face_data["embedding"]
        bbox = face_data["facial_area"]
        
        print(f"✅ Extraction successful. Confidence: {face_data.get('face_confidence', 0.99)}")
        return {
            "success": True,
            "embedding": embedding,
            "bbox": bbox,
            "confidence": face_data.get("face_confidence", 0.99),
        }
        
    except ValueError as ve:
        print("❌ Face not detected.")
        # DeepFace quăng ValueError nếu không thấy khuôn mặt
        return {"success": False, "error": "Không nhận diện được khuôn mặt. Vui lòng thử lại gần camera hơn."}
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail="Lỗi AI Server")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
