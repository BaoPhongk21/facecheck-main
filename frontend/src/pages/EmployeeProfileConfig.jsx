import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import useAuthStore from '../store/useAuthStore';
import { User, Mail, Phone, ShieldCheck, ShieldAlert, Camera, UploadCloud, RefreshCw, AlertCircle, LogIn, LogOut } from 'lucide-react';

const BACKEND_API = 'http://localhost:5000/api';
const AI_SERVICE_API = 'http://localhost:5000/api/v1';

const EmployeeProfileConfig = () => {
  const { user: employee, token, login } = useAuthStore();
  const [form, setForm] = useState(() => ({
    email: employee?.email || '',
    phone: employee?.phone || '',
    avatarUrl: employee?.avatarUrl || ''
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const fileInputRef = useRef(null);

  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  const webcamRef = useRef(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [faceMsg, setFaceMsg] = useState(null);
  const [faceError, setFaceError] = useState(null);

  useEffect(() => {
    if (employee) {
      const { email, phone, avatarUrl } = employee;
      Promise.resolve().then(() => {
        setForm({
          email: email || '',
          phone: phone || '',
          avatarUrl: avatarUrl || ''
        });
      });
    }
  }, [employee]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(f => ({ ...f, avatarUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await axios.put(`${BACKEND_API}/portal/update-profile`, form, { headers: { Authorization: `Bearer ${token}` } });
      login({ ...employee, ...res.data.employee }, token);
      setSaveMsg({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.response?.data?.error || 'Lỗi cập nhật' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsSavingPwd(true);
    setPwdMsg(null);
    try {
      await axios.post('http://localhost:5000/api/portal/change-password', pwdForm, { headers: { Authorization: `Bearer ${token}` } });
      setPwdMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.error || 'Lỗi đổi mật khẩu' });
    } finally {
      setIsSavingPwd(false);
    }
  };

  const captureFace = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    setIsProcessingFace(true);
    setFaceMsg(null);
    setFaceError(null);
    try {
      const aiRes = await axios.post(`${AI_SERVICE_API}/extract`, { image_base64: imageSrc });
      if (!aiRes.data.success) { setFaceError(aiRes.data.error || 'Không nhận diện được khuôn mặt'); return; }

      await axios.put(`${BACKEND_API}/portal/update-face`, { faceEmbedding: aiRes.data.embedding }, { headers: { Authorization: `Bearer ${token}` } });
      login({ ...employee, faceEnrolled: true }, token);
      setFaceMsg('Cập nhật khuôn mặt thành công! Bạn có thể sử dụng khuôn mặt này để điểm danh.');
    } catch (err) {
      setFaceError(err.response?.data?.error || 'Lỗi cập nhật khuôn mặt');
    } finally {
      setIsProcessingFace(false);
    }
  }, [webcamRef, token, employee, login]);

  if (!employee) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Thông tin cá nhân */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl p-8">
          <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-wider"><User className="text-indigo-400" size={24} /> Hồ sơ nhân sự</h3>

          <div className="flex items-center gap-6 mb-10 group">
            <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-3xl object-cover border-2 border-indigo-500/50 shadow-2xl transition-all group-hover:scale-105 group-hover:border-indigo-400" />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center font-black text-3xl border-2 border-indigo-500/50 shadow-2xl transition-all group-hover:scale-105">
                  {employee.fullName ? employee.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'NV'}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40 rounded-3xl backdrop-blur-sm">
                <Camera className="text-white" size={28} />
              </div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>
            <div>
              <h4 className="text-2xl font-black text-white tracking-tight">{employee.fullName}</h4>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Mã NV: <span className="text-indigo-400">{employee.employeeCode}</span> • {employee.department}</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest mt-3 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 transition-colors">Thay đổi ảnh</button>
            </div>
          </div>

          {saveMsg && (
            <div className={`p-4 rounded-2xl mb-8 text-sm font-bold border ${saveMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} animate-in zoom-in-95`}>
              {saveMsg.type === 'success' ? '✓ ' : '⚠ '}{saveMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-2"><Mail size={14} /> Email định danh</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-2"><Phone size={14} /> Số điện thoại</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <button type="submit" disabled={isSaving} className="w-full py-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50">
              {isSaving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>
        </div>

        {/* Đổi mật khẩu */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl p-8 h-fit">
          <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-wider"><ShieldCheck className="text-indigo-400" size={24} /> Bảo mật tài khoản</h3>
          {pwdMsg && (
            <div className={`p-4 rounded-2xl mb-8 text-sm font-bold border ${pwdMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} animate-in zoom-in-95`}>
              {pwdMsg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Mật khẩu hiện tại</label>
              <input type="password" required value={pwdForm.currentPassword} onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))} className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Mật khẩu mới</label>
              <input type="password" required value={pwdForm.newPassword} onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <button type="submit" disabled={isSavingPwd} className="w-full py-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50">
              {isSavingPwd ? 'Đang xác thực...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>

        {/* Cập nhật khuôn mặt */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl p-8 lg:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-wider"><Camera className="text-indigo-400" size={24} /> Sinh trắc học AI</h3>
            <span className={`inline-flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest ${employee.faceEnrolled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {employee.faceEnrolled ? <><ShieldCheck size={14} className="animate-pulse" /> Đã kích hoạt nhận diện</> : <><ShieldAlert size={14} className="animate-bounce" /> Chưa đăng ký khuôn mặt</>}
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-4">
               <p className="text-slate-400 text-sm leading-relaxed">Sử dụng dữ liệu khuôn mặt để điểm danh nhanh chóng và bảo mật mà không cần quẹt thẻ hay nhập mã PIN.</p>
               <div className="p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <h5 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><AlertCircle size={14} /> Hướng dẫn quan trọng</h5>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc ml-4">
                    <li>Đảm bảo đủ ánh sáng, không đeo kính râm hoặc khẩu trang.</li>
                    <li>Nhìn thẳng vào camera và giữ khoảng cách khoảng 50cm.</li>
                    <li>Hình ảnh được mã hóa thành vector và không lưu trữ file ảnh gốc.</li>
                  </ul>
               </div>
            </div>

            <div className="relative group">
              <div className="relative rounded-3xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-700/50 shadow-inner group-hover:border-indigo-500/50 transition-colors">
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />

                {isProcessingFace && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white z-20">
                    <RefreshCw size={40} className="animate-spin text-indigo-400 mb-4" />
                    <p className="font-black text-xs uppercase tracking-[0.2em]">Đang trích xuất đặc trưng AI...</p>
                  </div>
                )}

                {!isProcessingFace && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-indigo-500/30 border-dashed rounded-full animate-spin-slow"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  </div>
                )}
              </div>

              {faceError && <div className="mt-4 p-4 bg-rose-500/10 text-rose-400 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-rose-500/20 flex items-center gap-3 animate-in slide-in-from-top-2"><AlertCircle size={18} /> {faceError}</div>}
              {faceMsg && <div className="mt-4 p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-top-2"><ShieldCheck size={18} /> {faceMsg}</div>}

              <button onClick={captureFace} disabled={isProcessingFace} className="mt-6 w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
                {isProcessingFace ? 'Đang phân tích...' : <><UploadCloud size={20} /> Cập nhật dữ liệu khuôn mặt</>}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeProfileConfig;
