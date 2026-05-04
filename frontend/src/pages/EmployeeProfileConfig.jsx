import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import useAuthStore from '../store/useAuthStore';
import { User, Mail, Phone, ShieldCheck, ShieldAlert, Camera, UploadCloud, RefreshCw, AlertCircle } from 'lucide-react';

const EmployeeProfileConfig = () => {
  const { user: employee, token, login } = useAuthStore();
  const [form, setForm] = useState({ email: '', phone: '', avatarUrl: '' });
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
      setForm({ email: employee.email || '', phone: employee.phone || '', avatarUrl: employee.avatarUrl || '' });
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
      const res = await axios.put('http://localhost:5000/api/portal/update-profile', form, { headers: { Authorization: `Bearer ${token}` } });
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
      const aiRes = await axios.post('http://localhost:8000/api/v1/extract', { image_base64: imageSrc });
      if (!aiRes.data.success) { setFaceError(aiRes.data.error || 'Không nhận diện được khuôn mặt'); return; }
      
      await axios.put('http://localhost:5000/api/portal/update-face', { faceEmbedding: aiRes.data.embedding }, { headers: { Authorization: `Bearer ${token}` } });
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Thông tin cá nhân */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><User className="text-blue-600" size={20}/> Hồ sơ cá nhân</h3>
          
          <div className="flex items-center gap-4 mb-8">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm transition-opacity group-hover:opacity-75" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl border border-blue-200 shadow-sm transition-opacity group-hover:opacity-75">
                  {employee.fullName ? employee.fullName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'NV'}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl">
                <Camera className="text-white" size={24} />
              </div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">{employee.fullName}</h4>
              <p className="text-sm text-slate-500">MNV: {employee.employeeCode} · {employee.department}</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 font-semibold hover:underline mt-1">Đổi ảnh đại diện</button>
            </div>
          </div>

          {saveMsg && (
            <div className={`p-3 rounded-xl mb-6 text-sm font-medium ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {saveMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2"><Mail size={16}/> Email liên hệ</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2"><Phone size={16}/> Số điện thoại</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"/>
            </div>
            <button type="submit" disabled={isSaving} className="w-full py-3 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60">
              {isSaving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>
        </div>

        {/* Đổi mật khẩu */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2 xl:col-span-1">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><User className="text-blue-600" size={20}/> Đổi mật khẩu</h3>
          {pwdMsg && (
            <div className={`p-3 rounded-xl mb-6 text-sm font-medium ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {pwdMsg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu hiện tại</label>
              <input type="password" required value={pwdForm.currentPassword} onChange={e => setPwdForm(f => ({...f, currentPassword: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu mới</label>
              <input type="password" required value={pwdForm.newPassword} onChange={e => setPwdForm(f => ({...f, newPassword: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"/>
            </div>
            <button type="submit" disabled={isSavingPwd} className="w-full py-3 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60">
              {isSavingPwd ? 'Đang lưu...' : 'Lưu mật khẩu'}
            </button>
          </form>
        </div>

        {/* Cập nhật khuôn mặt */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Camera className="text-blue-600" size={20}/> Sinh trắc học</h3>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${employee.faceEnrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {employee.faceEnrolled ? <><ShieldCheck size={14}/> Đã đăng ký khuôn mặt</> : <><ShieldAlert size={14}/> Chưa đăng ký</>}
            </span>
          </div>

          <p className="text-sm text-slate-500 mb-4">Cập nhật khuôn mặt của bạn để hệ thống AI có thể nhận diện chính xác nhất khi điểm danh.</p>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center mb-4">
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} className="w-full h-full object-cover" />
            
            {isProcessingFace && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                <RefreshCw size={32} className="animate-spin text-blue-400 mb-3" />
                <p className="font-semibold text-sm">Đang trích xuất đặc trưng...</p>
              </div>
            )}

            {!isProcessingFace && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-blue-500/50 border-dashed rounded-full"></div>
              </div>
            )}
          </div>

          {faceError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2"><AlertCircle size={18}/> {faceError}</div>}
          {faceMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium flex items-center gap-2"><ShieldCheck size={18}/> {faceMsg}</div>}

          <button onClick={captureFace} disabled={isProcessingFace} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 disabled:opacity-60 flex items-center justify-center gap-2">
            {isProcessingFace ? 'Đang xử lý...' : <><UploadCloud size={18}/> Chụp & Cập nhật khuôn mặt</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmployeeProfileConfig;
