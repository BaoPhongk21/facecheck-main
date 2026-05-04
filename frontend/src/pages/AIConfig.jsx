import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import {
  Camera, RefreshCw, UploadCloud, ShieldCheck, AlertCircle,
  Fingerprint, Mail, Phone, Building2, BadgeCheck, XCircle,
  CheckCircle2, Clock, LogIn, LogOut
} from 'lucide-react';

const AIConfig = () => {
  const webcamRef = useRef(null);
  const [mode, setMode] = useState('IN'); // 'IN' = vào ca, 'OUT' = ra ca
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [error, setError] = useState(null);

  // Khi đổi chế độ → reset kết quả
  const switchMode = (m) => {
    setMode(m);
    setAiResult(null);
    setMatchResult(null);
    setActionResult(null);
    setError(null);
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    setIsProcessing(true);
    setAiResult(null);
    setMatchResult(null);
    setActionResult(null);
    setError(null);
    try {
      // Bước 1: AI Service trích xuất embedding
      const aiRes = await axios.post('http://localhost:8000/api/v1/extract', { image_base64: imageSrc });
      if (!aiRes.data.success) { setError(aiRes.data.error || 'Không nhận diện được khuôn mặt'); return; }
      setAiResult(aiRes.data);
      // Bước 2: Backend khớp nhân viên
      const idRes = await axios.post('http://localhost:5000/api/face/identify', { embedding: aiRes.data.embedding });
      setMatchResult(idRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Không thể kết nối với AI Service.');
    } finally {
      setIsProcessing(false);
    }
  }, [webcamRef]);

  // Xử lý vào ca / ra ca
  const handleAction = async () => {
    if (!matchResult?.employee?.id) return;
    setIsActing(true);
    setActionResult(null);
    try {
      const endpoint = mode === 'IN' ? 'http://localhost:5000/api/attendance/checkin' : 'http://localhost:5000/api/attendance/checkout';
      const res = await axios.post(endpoint, {
        employeeId: matchResult.employee.id,
        confidenceScore: matchResult.confidence / 100,
        type: mode
      });
      setActionResult({ ...res.data, mode });
    } catch (err) {
      setError(err.response?.data?.error || `Lỗi khi ${mode === 'IN' ? 'vào ca' : 'ra ca'}`);
    } finally {
      setIsActing(false);
    }
  };

  const resetAll = () => { setAiResult(null); setMatchResult(null); setActionResult(null); setError(null); };

  const isIN = mode === 'IN';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tiêu đề + Toggle chế độ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Điểm danh Camera AI</h2>
          <p className="text-slate-500 mt-1">Sử dụng nhận diện khuôn mặt để điểm danh vào/ra ca.</p>
        </div>

        {/* Toggle Vào ca / Ra ca */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 shadow-inner">
          <button
            onClick={() => switchMode('IN')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isIN ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogIn size={16} /> Vào ca (Check-in)
          </button>
          <button
            onClick={() => switchMode('OUT')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              !isIN ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogOut size={16} /> Ra ca (Check-out)
          </button>
        </div>
      </div>

      {/* Banner chế độ hiện tại */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border font-medium text-sm ${isIN ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
        {isIN ? <LogIn size={18}/> : <LogOut size={18}/>}
        <span>Chế độ hiện tại: <b>{isIN ? 'VÀO CA — Check-in' : 'RA CA — Check-out'}</b></span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${isIN ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {isIN ? 'Ghi nhận giờ đến' : 'Ghi nhận giờ về + tính giờ làm'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Camera ─── */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Camera size={18} className="text-blue-600" /> Luồng camera trực tiếp
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> TRỰC TIẾP
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} className="w-full h-full object-cover" />

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                <RefreshCw size={32} className="animate-spin text-blue-400 mb-3" />
                <p className="font-semibold text-sm tracking-wide">ĐANG NHẬN DIỆN...</p>
                <p className="text-xs text-slate-300 mt-1">DeepFace · Facenet · Cosine Match</p>
              </div>
            )}

            {!isProcessing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`w-48 h-48 border-2 border-dashed rounded-xl relative ${isIN ? 'border-blue-500/50' : 'border-emerald-500/50'}`}>
                  <div className={`absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 rounded-tl-lg ${isIN ? 'border-blue-500' : 'border-emerald-500'}`}></div>
                  <div className={`absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 rounded-tr-lg ${isIN ? 'border-blue-500' : 'border-emerald-500'}`}></div>
                  <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 rounded-bl-lg ${isIN ? 'border-blue-500' : 'border-emerald-500'}`}></div>
                  <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 rounded-br-lg ${isIN ? 'border-blue-500' : 'border-emerald-500'}`}></div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={capture} disabled={isProcessing}
              className={`flex-1 text-white font-medium py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isIN ? 'bg-blue-700 hover:bg-blue-800 shadow-blue-200' : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-200'}`}>
              <UploadCloud size={18} />
              {isProcessing ? 'Đang xử lý...' : 'Chụp & Nhận diện'}
            </button>
            {(aiResult || matchResult || error) && (
              <button onClick={resetAll} className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
                Làm mới
              </button>
            )}
          </div>
        </div>

        {/* ─── Kết quả ─── */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">Kết quả nhận diện</h3>

          <div className="flex-1 flex flex-col gap-4">
            {/* Lỗi */}
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div><h4 className="font-semibold text-sm">Thất bại</h4><p className="text-xs mt-1 text-red-600">{error}</p></div>
              </div>
            )}

            {/* Khuôn mặt phát hiện */}
            {aiResult && (
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-800">Khuôn mặt được phát hiện</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Model: Facenet · Độ tin cậy: {((aiResult.confidence || 0.98) * 100).toFixed(1)}% · Vector: 512D</p>
                </div>
              </div>
            )}

            {/* Kết quả vào/ra ca */}
            {actionResult && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${actionResult.mode === 'IN' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {actionResult.mode === 'IN' ? <LogIn size={20} className="text-blue-600 shrink-0 mt-0.5"/> : <LogOut size={20} className="text-emerald-600 shrink-0 mt-0.5"/>}
                <div>
                  <h4 className={`font-semibold text-sm ${actionResult.mode === 'IN' ? 'text-blue-900' : 'text-emerald-900'}`}>
                    ✅ {actionResult.message}
                  </h4>
                  <p className={`text-xs mt-1 ${actionResult.mode === 'IN' ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {new Date(actionResult.log?.checkTime).toLocaleTimeString('vi-VN')}
                    {actionResult.mode === 'IN' && actionResult.log && (
                      <> · {actionResult.log.isLate ? <span className="text-orange-600 font-semibold"> Đến trễ</span> : <span className="text-emerald-600 font-semibold"> Đúng giờ</span>}</>
                    )}
                    {actionResult.mode === 'OUT' && actionResult.log?.workHours && (
                      <> · <span className="font-semibold">Đã làm: {actionResult.log.workHours} giờ</span></>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Card nhân viên khớp */}
            {matchResult && matchResult.matched && matchResult.employee && !actionResult && (
              <div className="border border-blue-100 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-slate-50">
                <div className={`h-1 bg-gradient-to-r ${isIN ? 'from-blue-500 to-indigo-500' : 'from-emerald-500 to-teal-500'}`} />
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-5">
                    {matchResult.employee.avatarUrl ? (
                      <img src={matchResult.employee.avatarUrl} alt={matchResult.employee.fullName} className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-200 shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl border-2 border-blue-200 shadow-sm">
                        {matchResult.employee.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-slate-900">{matchResult.employee.fullName}</span>
                        <BadgeCheck size={16} className="text-blue-500 shrink-0" />
                      </div>
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        MNV: {matchResult.employee.employeeCode}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-4">
                    {matchResult.employee.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"><Mail size={14} /></div>
                        <span className="text-slate-700 truncate">{matchResult.employee.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"><Building2 size={14} /></div>
                      <span className="text-slate-700">{matchResult.employee.department}</span>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Độ khớp</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${isIN ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} style={{ width: `${matchResult.confidence}%` }} />
                      </div>
                      <span className={`text-sm font-bold ${isIN ? 'text-blue-700' : 'text-emerald-700'}`}>{matchResult.confidence}%</span>
                    </div>
                  </div>

                  {/* NÚT VÀO CA / RA CA */}
                  <button onClick={handleAction} disabled={isActing}
                    className={`w-full py-3 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 ${isIN ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
                    {isActing
                      ? <><RefreshCw size={16} className="animate-spin" /> Đang xử lý...</>
                      : isIN
                        ? <><LogIn size={16} /> Xác nhận Vào ca (Check-in)</>
                        : <><LogOut size={16} /> Xác nhận Ra ca (Check-out)</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Không khớp */}
            {matchResult && !matchResult.matched && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                <XCircle size={20} className="text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-orange-800">Không nhận diện được nhân viên</h4>
                  <p className="text-xs text-orange-600 mt-1">{matchResult.message}{matchResult.confidence != null && ` (Score: ${matchResult.confidence}%)`}</p>
                  <p className="text-xs text-orange-500 mt-1">Hãy đảm bảo nhân viên đã được đăng ký khuôn mặt.</p>
                </div>
              </div>
            )}

            {/* Chờ */}
            {!aiResult && !matchResult && !error && !isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
                <Fingerprint size={48} className="mb-4 opacity-40" />
                <p className="text-sm font-medium">Sẵn sàng {isIN ? 'Check-in' : 'Check-out'}</p>
                <p className="text-xs mt-1 text-center">Đưa khuôn mặt vào khung và nhấn Chụp &amp; Nhận diện</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfig;
