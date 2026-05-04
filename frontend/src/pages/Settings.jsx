import { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Save, Info } from 'lucide-react';

const Settings = () => {
  const [config, setConfig] = useState({ hourlyRate: 100000, standardHours: 176 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/config')
      .then(res => setConfig(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await axios.put('http://localhost:5000/api/config', config);
      setConfig(res.data);
      setMsg({ type: 'success', text: 'Đã lưu cấu hình hệ thống!' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Lỗi lưu cấu hình' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Cấu hình hệ thống</h2>
          <p className="text-slate-500 mt-1">Thiết lập các tham số dùng chung cho toàn bộ hệ thống tính lương và nhân sự.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><SettingsIcon className="text-blue-600" size={20}/> Cấu hình bảng lương</h3>
        
        {msg && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <Info size={18}/> {msg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lương cơ bản mỗi giờ (VNĐ)</label>
              <input type="number" required value={config.hourlyRate} onChange={e => setConfig(f => ({...f, hourlyRate: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="100000"/>
              <p className="text-xs text-slate-500 mt-2">Dùng để tính lương chính thức và lương tăng ca (x1.5).</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số giờ làm chuẩn mỗi tháng</label>
              <input type="number" required value={config.standardHours} onChange={e => setConfig(f => ({...f, standardHours: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="176"/>
              <p className="text-xs text-slate-500 mt-2">Vượt quá số giờ này sẽ được tính là làm thêm giờ (Overtime).</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 disabled:opacity-60 flex items-center gap-2">
              {isSaving ? 'Đang lưu...' : <><Save size={18}/> Lưu cấu hình</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
