import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import {
  Camera, RefreshCw, ShieldCheck, AlertCircle,
  Fingerprint, Mail, Phone, Building2, BadgeCheck, XCircle,
  CheckCircle2, Clock, LogIn, LogOut, ScanFace, UserCheck,
  Eye, ArrowLeft, ArrowRight
} from 'lucide-react';

const BACKEND_API_BASE_URL = 'http://localhost:5000';

const AIConfig = () => {
  const webcamRef = useRef(null);
  const [mode, setMode] = useState('IN'); // 'IN' = vào ca, 'OUT' = ra ca
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [error, setError] = useState(null);

  // Trạng thái thử thách người thật (Liveness Challenge)
  const [isVerifying, setIsVerifying] = useState(false);
  const [challengePassed, setChallengePassed] = useState(false);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeStatus, setChallengeStatus] = useState('WAITING'); // 'WAITING', 'PROCESSING', 'SUCCESS'
  
  // Chỉ giữ lại 3 bước: Chớp mắt, Trái, Phải
  const challenges = [
    { id: 'BLINK', label: 'Vui lòng chớp mắt', icon: <Eye className="text-blue-500" /> },
    { id: 'LEFT', label: 'Quay mặt sang TRÁI', icon: <ArrowLeft className="text-blue-500" /> },
    { id: 'RIGHT', label: 'Quay mặt sang PHẢI', icon: <ArrowRight className="text-blue-500" /> },
  ];

  // Hàm phát thông báo bằng giọng nói (Tiếng Việt)
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice =>
      voice.lang.includes('vi') &&
      (voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('hoaimy') ||
        voice.name.toLowerCase().includes('linh') ||
        voice.name.toLowerCase().includes('google'))
    );
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.pitch = 1.1;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const switchMode = (m) => {
    setMode(m);
    resetAll();
  };

  const capture = useCallback(async () => {
    if (!challengePassed) {
      startLivenessChallenge();
      return;
    }
    
    const imageSrc = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
    if (!imageSrc) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const idRes = await axios.post(`${BACKEND_API_BASE_URL}/api/face/quick-scan`, { image_base64: imageSrc });

      if (idRes.data.aiData) setAiResult(idRes.data.aiData);
      setMatchResult(idRes.data);

      if (!idRes.data.matched) {
        setError(idRes.data.message || 'Không nhận diện được nhân viên');
        return;
      }

      if (idRes.data.employee?.id) {
        setIsActing(true);
        const endpoint = mode === 'IN' ? `${BACKEND_API_BASE_URL}/api/attendance/checkin` : `${BACKEND_API_BASE_URL}/api/attendance/checkout`;
        const actionRes = await axios.post(endpoint, {
          employeeId: idRes.data.employee.id,
          confidenceScore: idRes.data.confidence / 100,
          type: mode
        });
        setActionResult({ ...actionRes.data, mode });

        const employeeName = idRes.data.employee.fullName;
        const message = mode === 'IN'
          ? `Chào mừng ${employeeName} đã vào ca.`
          : `Cảm ơn ${employeeName}, hẹn gặp lại bạn.`;
        speak(message);

        setTimeout(() => resetAll(), 7000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Không thể kết nối với AI Service.');
    } finally {
      setIsProcessing(false);
      setIsActing(false);
      setIsVerifying(false);
      setChallengeIndex(0);
      setChallengePassed(false);
    }
  }, [webcamRef, mode, challengePassed]);

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
    const maxSteps = challenges.length;
    
    const runStep = async () => {
      if (currentStep >= maxSteps) {
        setChallengePassed(true);
        setIsVerifying(false);
        return;
      }
      
      setChallengeIndex(currentStep);
      setChallengeStatus('WAITING');
      speak(challenges[currentStep].label);
      
      await new Promise(r => setTimeout(r, 1200));
      setChallengeStatus('PROCESSING');
      
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        if (attempts > 50) {
          clearInterval(checkInterval);
          setIsVerifying(false);
          setError(`Không nhận diện được hành động: ${challenges[currentStep].label}. Vui lòng thử lại.`);
          return;
        }
        
        const frame = webcamRef.current?.getScreenshot({ width: 320, height: 240 });
        if (!frame) return;
        
        try {
          const res = await axios.post(`${BACKEND_API_BASE_URL}/api/v1/liveness-check`, { image_base64: frame });
          const { face_detected, pose, eyes } = res.data;
          
          if (!face_detected) return;
          
          let passed = false;
          const target = challenges[currentStep].id;
          if (target === 'BLINK') {
            if (eyes === 'CLOSED') passed = true; 
          } else {
            if (pose === target) passed = true;
          }
          
          if (passed) {
            clearInterval(checkInterval);
            setChallengeStatus('SUCCESS');
            currentStep++;
            setTimeout(runStep, 1000);
          }
        } catch (err) {
          console.error("Liveness error:", err);
        }
      }, 300);
    };
    
    runStep();
  };

  const handleAction = async () => {
    if (!matchResult?.employee?.id) return;
    setIsActing(true);
    setActionResult(null);
    try {
      const endpoint = mode === 'IN' ? `${BACKEND_API_BASE_URL}/api/attendance/checkin` : `${BACKEND_API_BASE_URL}/api/attendance/checkout`;
      const res = await axios.post(endpoint, {
        employeeId: matchResult.employee.id,
        confidenceScore: matchResult.confidence / 100,
        type: mode
      });
      setActionResult({ ...res.data, mode });
      const employeeName = matchResult.employee.fullName;
      const message = mode === 'IN' ? `Chào mừng ${employeeName} đã vào ca.` : `Cảm ơn ${employeeName}, hẹn gặp lại bạn.`;
      speak(message);
      setTimeout(() => resetAll(), 7000);
    } catch (err) {
      setError(err.response?.data?.error || `Lỗi khi ${mode === 'IN' ? 'vào ca' : 'ra ca'}`);
    } finally {
      setIsActing(false);
    }
  };

  const resetAll = () => { 
    setAiResult(null); setMatchResult(null); setActionResult(null); setError(null); 
    setIsVerifying(false); setChallengeIndex(0); setChallengePassed(false);
  };

  const isIN = mode === 'IN';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Điểm danh Camera AI</h2>
          <p className="text-slate-500 mt-1">Xác thực người thật 3 bước (Chớp mắt, Trái, Phải).</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 shadow-inner">
          <button onClick={() => switchMode('IN')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isIN ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:text-slate-700'}`}>
            <LogIn size={16} /> Vào ca
          </button>
          <button onClick={() => switchMode('OUT')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${!isIN ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:text-slate-700'}`}>
            <LogOut size={16} /> Ra ca
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Camera size={18} className="text-blue-600" /> Camera xác thực
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> BẢO MẬT CAO
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.8} videoConstraints={{ width: 640, height: 480, facingMode: 'user' }} mirrored={true} className="w-full h-full object-cover" />

            {isVerifying && (
              <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center text-white z-30 p-6 text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 relative animate-pulse">
                   <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping"></div>
                   {challenges[challengeIndex].icon}
                </div>
                <h4 className="text-xl font-bold mb-2">{challenges[challengeIndex].label}</h4>
                <p className="text-blue-300 text-sm font-medium">BƯỚC {challengeIndex + 1}/{challenges.length}</p>
                <div className="mt-8 w-full max-w-[200px] h-1.5 bg-white/20 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((challengeIndex + (challengeStatus === 'SUCCESS' ? 1 : 0)) / challenges.length) * 100}%` }} />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white z-40">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-lg text-blue-400">ĐÃ LẤY HÌNH ẢNH!</p>
                <p className="text-sm text-slate-300">Đang nhận diện nhân viên...</p>
              </div>
            )}

            {!isVerifying && !isProcessing && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="relative w-64 h-80 border-2 border-white/20 rounded-[3rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line z-10"></div>
                   <div className="absolute bottom-12 text-[10px] text-white/60 font-bold tracking-widest uppercase bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Đặt khuôn mặt vào khung</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={capture} disabled={isProcessing || isVerifying} className={`flex-1 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 ${isIN ? 'bg-gradient-to-r from-blue-600 to-blue-800' : 'bg-gradient-to-r from-emerald-600 to-emerald-800'}`}>
              <ScanFace size={22} /> {isVerifying ? 'Đang xác thực...' : 'Bắt đầu điểm danh'}
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">Thông tin nhận diện</h3>
          <div className="flex-1">
            {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3 mb-4"><AlertCircle size={20} className="shrink-0" /><div><h4 className="font-semibold text-sm">Lỗi</h4><p className="text-xs mt-1">{error}</p></div></div>}
            {actionResult && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${actionResult.mode === 'IN' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {actionResult.mode === 'IN' ? <LogIn size={20} className="text-blue-600" /> : <LogOut size={20} className="text-emerald-600" />}
                <div><h4 className="font-semibold text-sm text-slate-900">{actionResult.message}</h4><p className="text-xs text-slate-500 mt-1">{new Date(actionResult.log?.checkTime).toLocaleTimeString('vi-VN')}</p></div>
              </div>
            )}
            {matchResult?.matched && !actionResult && (
              <div className="border border-blue-100 rounded-2xl p-5 bg-slate-50 flex flex-col items-center">
                 {matchResult.employee.avatarUrl ? <img src={matchResult.employee.avatarUrl} className="w-20 h-20 rounded-2xl object-cover mb-3" /> : <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center font-bold text-2xl text-blue-700 mb-3">{matchResult.employee.fullName[0]}</div>}
                 <h4 className="text-lg font-bold text-slate-900">{matchResult.employee.fullName}</h4>
                 <p className="text-sm text-slate-500 mb-4">{matchResult.employee.department}</p>
                 <button onClick={handleAction} className={`w-full py-3 text-white font-semibold rounded-xl ${isIN ? 'bg-blue-600' : 'bg-emerald-600'}`}>Xác nhận</button>
              </div>
            )}
            {!aiResult && !matchResult && !error && !isVerifying && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12"><Fingerprint size={64} className="mb-4 opacity-20" /><p className="text-sm font-medium">Sẵn sàng quét khuôn mặt</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfig;
