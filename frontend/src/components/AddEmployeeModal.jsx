import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { X, Camera, RefreshCw, UploadCloud, ShieldCheck, AlertCircle, ScanFace, Eye, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

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
  const [challengeStatus, setChallengeStatus] = useState('WAITING');
  
  const challenges = [
    { id: 'BLINK', label: 'Chớp mắt', icon: <Eye className="text-blue-500" /> },
    { id: 'LEFT', label: 'Nhìn sang TRÁI', icon: <ArrowLeft className="text-blue-500" /> },
    { id: 'RIGHT', label: 'Nhìn sang PHẢI', icon: <ArrowRight className="text-blue-500" /> },
  ];

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
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const capture = useCallback(async () => {
    if (!challengePassed) {
      startLivenessChallenge();
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await axios.post(`${BACKEND_API_BASE_URL}/api/v1/extract`, {
        image_base64: imageSrc
      });

      if (response.data.success) {
        setFaceEmbedding(response.data.embedding);
      } else {
        setError(response.data.error || 'Trích xuất khuôn mặt thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Không thể kết nối với AI Service.');
    } finally {
      setIsProcessing(false);
      setIsVerifying(false);
      setChallengePassed(false); // Quan trọng: Reset cho lần sau
    }
  }, [webcamRef, challengePassed]);

  useEffect(() => {
    if (challengePassed) {
      capture();
    }
  }, [challengePassed, capture]);

  const startLivenessChallenge = async () => {
    setIsVerifying(true);
    setChallengePassed(false);
    setChallengeIndex(0);
    setChallengeStatus('WAITING');
    setError(null);
    
    let currentStep = 0;
    
    const runStep = async () => {
      if (currentStep >= challenges.length) {
        setChallengePassed(true);
        setIsVerifying(false);
        return;
      }
      
      setChallengeIndex(currentStep);
      setChallengeStatus('WAITING');
      await new Promise(r => setTimeout(r, 1200));
      setChallengeStatus('PROCESSING');
      
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        if (attempts > 50) {
          clearInterval(checkInterval);
          setIsVerifying(false);
          setError(`Xác thực thất bại ở bước: ${challenges[currentStep].label}. Hãy thử lại.`);
          return;
        }
        
        const frame = webcamRef.current?.getScreenshot({ width: 320, height: 240 });
        if (!frame) return;
        
        try {
          const res = await axios.post(`${BACKEND_API_BASE_URL}/api/v1/liveness-check`, { image_base64: frame });
          const { face_detected, pose, eyes } = res.data;
          
          if (!face_detected) return;
          
          let passed = false;
          if (challenges[currentStep].id === 'BLINK') {
            if (eyes === 'CLOSED') passed = true;
          } else {
            if (pose === challenges[currentStep].id) passed = true;
          }
          
          if (passed) {
            clearInterval(checkInterval);
            setChallengeStatus('SUCCESS');
            currentStep++;
            setTimeout(runStep, 1000);
          }
        } catch (err) {}
      }, 300);
    };
    
    runStep();
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
        faceEmbedding
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
                  Tiếp theo: Quét khuôn mặt →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!faceEmbedding ? (
                <>
                  <p className="text-sm text-slate-500 text-center">Đưa khuôn mặt của <span className="font-semibold text-slate-700">{formData.fullName}</span> vào khung và nhấn Chụp để đăng ký sinh trắc học.</p>
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} mirrored={true} className="w-full h-full object-cover" />
                    {isVerifying && (
                      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center text-white z-30 p-6 text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 relative">
                           <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping"></div>
                           {challenges[challengeIndex].icon}
                        </div>
                        <h4 className="text-lg font-bold mb-1">{challenges[challengeIndex].label}</h4>
                        <p className="text-blue-300 text-xs font-medium">BƯỚC {challengeIndex + 1}/{challenges.length}</p>
                        
                        {challengeStatus === 'SUCCESS' && (
                          <div className="mt-2 flex items-center gap-1 text-emerald-400 text-sm font-bold animate-bounce">
                            <CheckCircle2 size={16} /> HOÀN THÀNH
                          </div>
                        )}
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
                        <div className="relative w-56 h-64 border-2 border-white/20 rounded-[2.5rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden">
                           <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-scan-line"></div>
                           <div className="absolute bottom-8 text-[9px] text-white/60 font-bold tracking-widest uppercase bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                             Đặt khuôn mặt vào khung
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">← Quay lại</button>
                    <button onClick={capture} disabled={isProcessing} className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50">
                      {isProcessing ? (
                        <><RefreshCw size={18} className="animate-spin" /> Đang xác thực...</>
                      ) : (
                        <><ScanFace size={20} /> Chụp & Đăng ký người thật</>
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
                    <button onClick={() => setFaceEmbedding(null)} className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">Quét lại</button>
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
