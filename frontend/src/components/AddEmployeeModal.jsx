import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { X, Camera, RefreshCw, UploadCloud, ShieldCheck, AlertCircle, ScanFace, User, ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Trash2, Video } from 'lucide-react';

// Thay 'localhost' bằng URL Cloudflare hoặc Tên-máy-tính.local tại đây
const BACKEND_API_BASE_URL = 'http://localhost:5000'; // For backend API calls
const AI_SERVICE_BASE_URL = 'http://localhost:8000'; // For direct AI Service calls

const AddEmployeeModal = ({ isOpen, onClose, onAdded }) => {
  const [step, setStep] = useState(1); // 1: Thông tin, 2: Quét khuôn mặt
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    phone: '',
    departmentId: ''
  });
  const [departments, setDepartments] = useState([]);
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const webcamRef = useRef(null);

  // Liveness Challenge State
  const [isVerifying, setIsVerifying] = useState(false);
  const [challengePassed, setChallengePassed] = useState(false);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [capturedImagesForEnroll, setCapturedImagesForEnroll] = useState([null, null, null]);
  const [isScanning, setIsScanning] = useState(false);
  const scanTimerRef = useRef(null);

  const challenges = [
    { id: 'CENTER', label: 'Vui lòng nhìn THẲNG vào camera', icon: <User className="text-blue-500" />, poseTarget: 'CENTER' },
    { id: 'LEFT', label: 'Vui lòng quay mặt sang TRÁI', icon: <ArrowLeft className="text-blue-500" />, poseTarget: 'LEFT' },
    { id: 'RIGHT', label: 'Vui lòng quay mặt sang PHẢI', icon: <ArrowRight className="text-blue-500" />, poseTarget: 'RIGHT' },
  ];

  // Hàm phát giọng nói hướng dẫn
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Dừng các câu nói trước đó
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.1; // Chỉnh giọng nữ thanh hơn

      // Ưu tiên tìm giọng Nữ (Female)
      const voices = window.speechSynthesis.getVoices();
      const vnVoice = voices.find(v =>
        v.lang.includes('VN') &&
        (v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('lan') ||
          v.name.toLowerCase().includes('linh'))
      ) || voices.find(v => v.lang.includes('VN'));

      if (vnVoice) utterance.voice = vnVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isOpen) {
      axios.get(`${BACKEND_API_BASE_URL}/api/departments`)
        .then(res => setDepartments(res.data))
        .catch(err => console.error(err));
    } else {
      setStep(1);
      setFormData({ employeeCode: '', fullName: '', email: '', phone: '', departmentId: '' });
      setFaceEmbedding(null);
      setError(null);
    }
    return () => window.speechSynthesis.cancel();
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Logic Quét Video Tự động
  const startVideoScan = () => {
    setIsScanning(true);
    setChallengeIndex(0);
    setCapturedImagesForEnroll([null, null, null]);
    setError(null);
    speak("Bắt đầu quét khuôn mặt. Vui lòng nhìn thẳng vào camera.");
  };

  useEffect(() => {
    if (isScanning && !challengePassed) {
      scanTimerRef.current = setInterval(async () => {
        if (isProcessing) return;
        autoScanFrame();
      }, 800); // Quét mỗi 800ms để đảm bảo hiệu năng
    } else {
      clearInterval(scanTimerRef.current);
    }
    return () => clearInterval(scanTimerRef.current);
  }, [isScanning, challengeIndex, isProcessing, challengePassed]);

  const autoScanFrame = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    const base64 = imageSrc.split(',')[1];

    try {
      // Gọi AI Service để kiểm tra tư thế (Liveness Check)
      const res = await axios.post(`${BACKEND_API_BASE_URL}/api/v1/liveness-check`, {
        image_base64: base64
      });

      const { face_detected, pose } = res.data;

      if (!face_detected) {
        setError("Không tìm thấy khuôn mặt. Hãy đưa mặt vào khung hình.");
        return;
      }

      setError(null);
      const currentTarget = challenges[challengeIndex].poseTarget;

      if (pose === currentTarget) {
        // Chụp ảnh chất lượng cao cho góc này
        const newImages = [...capturedImagesForEnroll];
        newImages[challengeIndex] = base64;
        setCapturedImagesForEnroll(newImages);

        if (challengeIndex < challenges.length - 1) {
          const nextIdx = challengeIndex + 1;
          setChallengeIndex(nextIdx);
          speak(`Đã nhận diện. ${challenges[nextIdx].label}`);
        } else {
          // Đã xong 3 góc
          setIsScanning(false);
          clearInterval(scanTimerRef.current);
          handleMultiEnroll(newImages);
        }
      }
    } catch (err) {
      console.error("Scan error:", err);
    }
  };

  // Hàm chụp ảnh thủ công (fallback)
  const manualCapture = useCallback(async () => {
    if (isProcessing || isScanning) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    const base64 = imageSrc.split(',')[1];

    const newImages = [...capturedImagesForEnroll];
    newImages[challengeIndex] = base64;
    setCapturedImagesForEnroll(newImages);

    if (challengeIndex < challenges.length - 1) {
      setChallengeIndex(prev => prev + 1);
    } else if (newImages.every(img => img !== null)) {
      handleMultiEnroll(newImages);
    }
  }, [webcamRef, challengeIndex, capturedImagesForEnroll, isScanning, isProcessing]);

  const handleMultiEnroll = async (images) => {
    setIsProcessing(true);
    setError(null);
    setIsVerifying(true); // Hiển thị trạng thái đang xử lý

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${BACKEND_API_BASE_URL}/api/face/enroll-multi-images`, {
        employeeId: null, // Sẽ được xử lý ở handleSubmit hoặc lưu tạm vector
        images_base64: images
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Vì logic cũ cần embedding để submit cùng form, 
      // nhưng enroll-multi-images đã lưu thẳng vào DB.
      // Để giữ flow cũ, ta sẽ đánh dấu thành công.
      setChallengePassed(true);
      speak('Quét video hoàn tất. Khuôn mặt đã được đăng ký. Vui lòng nhấn lưu.');
      setFaceEmbedding(response.data.embedding); // Lưu vector thật trả về từ server
    } catch (err) {
      setError(err.response?.data?.error || 'Xác thực đa góc độ thất bại. Vui lòng thử lại.');
      resetCapture();
    } finally {
      setIsProcessing(false);
      setIsVerifying(false);
    }
  };

  const resetCapture = () => {
    setChallengeIndex(0);
    setCapturedImagesForEnroll([null, null, null]);
    setChallengePassed(false);
    setIsScanning(false);
    setFaceEmbedding(null);
  };

  const handleSubmit = async () => {
    if (!faceEmbedding) {
      setError('Vui lòng quét khuôn mặt trước khi lưu.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await axios.post(`${BACKEND_API_BASE_URL}/api/employees`, {
        ...formData,
        faceEmbedding // Gửi vector khuôn mặt thật lên để lưu cùng thông tin nhân viên
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi lưu nhân viên');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Tiêu đề */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Thêm nhân viên mới</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Chỉ báo bước */}
        <div className="px-6 pt-4 flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm font-semibold ${step === 1 ? 'text-blue-600' : 'text-emerald-600'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step === 1 ? 'bg-blue-600' : 'bg-emerald-500'}`}>1</span>
            Thông tin cơ bản
          </div>
          <div className="flex-1 h-px bg-slate-200"></div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${step === 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step === 2 ? 'bg-blue-600' : 'bg-slate-300'}`}>2</span>
            Quét khuôn mặt
          </div>
        </div>

        {/* Nội dung */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mã nhân viên *</label>
                  <input type="text" name="employeeCode" value={formData.employeeCode} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="VD: NV001" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Họ và tên *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="VD: Nguyễn Văn A" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="VD: a.nguyen@biohr.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số điện thoại</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="VD: 0987654321" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phòng ban *</label>
                <select name="departmentId" value={formData.departmentId} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                  <option value="">Chọn phòng ban...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => {
                    if (!formData.employeeCode || !formData.fullName || !formData.departmentId) {
                      setError('Vui lòng điền các trường bắt buộc (*)');
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors shadow-sm"
                >
                  Bắt đầu đăng ký khuôn mặt →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!faceEmbedding ? (
                <>
                  <p className="text-sm text-slate-500 text-center italic">Hệ thống sẽ tự động quét khi mặt nằm đúng khung hình và góc độ.</p>
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} mirrored={true} className="w-full h-full object-cover" />
                    {isVerifying && (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30 p-6 text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 relative">
                          <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping"></div>
                          {challenges[challengeIndex].icon}
                        </div>
                        <h4 className="text-lg font-bold mb-1">{challenges[challengeIndex].label}</h4>
                        <p className="text-blue-300 text-xs font-medium">BƯỚC {challengeIndex + 1}/{challenges.length}</p>
                      </div>
                    )}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white z-40">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-bold text-sm text-blue-400">ĐÃ LẤY HÌNH ẢNH!</p>
                        <p className="text-[10px] text-slate-300">Đang trích xuất dữ liệu...</p>
                      </div>
                    )}
                    {!isProcessing && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className={`relative w-56 h-64 border-2 ${error ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : isScanning ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'border-blue-400'} rounded-[2.5rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden transition-all duration-300`}>
                          <div className={`absolute top-0 left-0 w-full h-1 ${isScanning ? 'bg-emerald-400' : 'bg-blue-400'} shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-scan-line`}></div>
                          <div className="absolute bottom-8 text-[9px] text-white/60 font-bold tracking-widest uppercase bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                            {error ? 'MẶT NGOÀI KHUNG HÌNH' : isScanning ? 'ĐANG QUÉT VIDEO...' : 'SẴN SÀNG QUÉT'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Danh sách ảnh thumbnails */}
                  <div className="flex justify-center gap-3 py-4">
                    {challenges.map((ch, idx) => (
                      <div key={ch.id} className="relative group">
                        <div className={`w-20 h-24 rounded-xl border-2 overflow-hidden bg-slate-800 transition-all ${challengeIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' :
                          capturedImagesForEnroll[idx] ? 'border-emerald-500' : 'border-slate-700'
                          }`}>
                          {capturedImagesForEnroll[idx] ? (
                            <img src={`data:image/jpeg;base64,${capturedImagesForEnroll[idx]}`} className="w-full h-full object-cover" alt="Captured" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              {ch.icon}
                            </div>
                          )}
                        </div>
                        <div className="text-[9px] text-center mt-1 font-bold text-slate-500 uppercase">{ch.id}</div>

                        {capturedImagesForEnroll[idx] && !isProcessing && (
                          <button
                            onClick={() => handleRetake(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">← Quay lại</button>
                    <button onClick={isScanning ? () => setIsScanning(false) : startVideoScan} disabled={isProcessing} className={`flex items-center gap-2 px-8 py-3.5 ${isScanning ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-2xl transition-all shadow-lg disabled:opacity-50`}>
                      {isScanning ? (
                        <><RefreshCw size={20} className="animate-spin" /> Dừng quét</>
                      ) : (
                        <><Video size={20} /> Bắt đầu Quét Video</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-4 text-emerald-600">
                    <ShieldCheck size={40} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Quét khuôn mặt thành công!</h3>
                  <p className="text-slate-500 text-sm mb-6">Đã thu thập dữ liệu sinh trắc học cho <span className="font-semibold text-slate-700">{formData.fullName}</span></p>

                  <div className="flex gap-3 justify-center">
                    <button onClick={resetCapture} className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">Quét lại</button>
                    <button onClick={handleSubmit} disabled={isProcessing} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50">
                      {isProcessing ? 'Đang lưu...' : '✓ Lưu nhân viên'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddEmployeeModal;
