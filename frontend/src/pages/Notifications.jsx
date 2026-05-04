import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Bell, X, AlertCircle, Calendar } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const NewNotificationModal = ({ onClose, onSaved, isDark }) => {
  const [form, setForm] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) { setError('Vui lòng nhập đầy đủ tiêu đề và nội dung'); return; }
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/notifications', form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi thông báo');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className={`${isDark ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-100'} border rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-300 overflow-hidden`}>
        <div className={`px-8 py-6 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-100 bg-slate-50'} flex items-center justify-between`}>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider`}>Tạo thông báo mới</h2>
          <button onClick={onClose} className={`p-2 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} rounded-full transition-colors`}><X size={24}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && <div className={`p-4 ${isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-red-50 text-red-600 border-red-100'} border rounded-2xl text-xs font-bold flex items-center gap-3 animate-pulse`}><AlertCircle size={18}/>{error}</div>}
          
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Tiêu đề thông báo *</label>
            <input 
              value={form.title} 
              onChange={e => setForm(f => ({...f, title: e.target.value}))} 
              className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 shadow-inner`} 
              placeholder="Ví dụ: Lịch nghỉ lễ 30/4 & 1/5"
            />
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Nội dung chi tiết *</label>
            <textarea 
              value={form.content} 
              onChange={e => setForm(f => ({...f, content: e.target.value}))} 
              rows={6} 
              className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner`} 
              placeholder="Nhập nội dung thông báo gửi đến toàn thể nhân viên..."
            />
          </div>

          <div className="flex gap-4 justify-end pt-4">
            <button type="button" onClick={onClose} className={`px-8 py-4 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} font-black text-xs uppercase tracking-widest rounded-2xl transition-all`}>Hủy</button>
            <button type="submit" disabled={loading} className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2">
              {loading ? 'Đang gửi...' : <><Bell size={18}/> Gửi thông báo ngay</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Notifications = () => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const r = await axios.get('http://localhost:5000/api/notifications');
      setNotifications(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/notifications/${id}`);
      fetchNotifications();
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
    }
  };

  const isDark = user?.role === 'EMPLOYEE';

  if (loading) return <div className={`p-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-500'} font-black animate-pulse`}>Đang tải trung tâm thông báo...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight uppercase`}>Trung tâm Thông báo</h2>
          <p className="text-slate-500 mt-2 font-medium">{isDark ? 'Cập nhật những tin tức và chính sách mới nhất từ công ty.' : 'Quản lý các bản tin nội bộ và thông báo đến nhân viên.'}</p>
        </div>
        {user?.role !== 'EMPLOYEE' && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98]">
            <Plus size={20}/> Tạo thông báo mới
          </button>
        )}
      </div>

      <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'} border rounded-[2.5rem] overflow-hidden backdrop-blur-xl`}>
        <div className={`p-8 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-100 bg-slate-50/50'}`}>
          <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-3 text-lg uppercase tracking-wider`}><Bell size={24} className="text-indigo-400"/> Lịch sử thông báo</h3>
        </div>
        
        <div className={`divide-y ${isDark ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
          {notifications.length === 0 ? (
            <div className="p-20 text-center">
              <div className={`w-24 h-24 ${isDark ? 'bg-slate-900/50 text-slate-700' : 'bg-slate-50 text-slate-300'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <Bell size={48} />
              </div>
              <h3 className={`text-xl font-black ${isDark ? 'text-slate-200' : 'text-slate-900'} mb-2`}>Hiện tại không có thông báo</h3>
              <p className="text-slate-500 text-sm font-medium">Bạn sẽ nhận được tin tức mới tại đây khi có cập nhật từ công ty.</p>
            </div>
          ) : notifications.map((n) => (
            <div key={n.id} className={`p-8 ${isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'} transition-all flex items-start justify-between gap-8 group`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <h4 className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} text-xl group-hover:text-indigo-400 transition-colors`}>{n.title}</h4>
                   {new Date(n.date).toDateString() === new Date().toDateString() && (
                     <span className="bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter animate-bounce">Mới</span>
                   )}
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Calendar size={12} /> {new Date(n.date).toLocaleString('vi-VN')}
                </p>
                <div className={`text-sm ${isDark ? 'text-slate-400 border-slate-700/50 bg-slate-900/30' : 'text-slate-600 border-slate-100 bg-white'} leading-relaxed border p-6 rounded-[1.5rem] shadow-inner font-medium`}>
                  {n.content}
                </div>
              </div>
              {user?.role !== 'EMPLOYEE' && (
                <button 
                  onClick={() => handleDelete(n.id)} 
                  className={`p-3 ${isDark ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-400/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'} rounded-2xl transition-all shadow-sm opacity-0 group-hover:opacity-100`}
                  title="Xóa thông báo"
                >
                  <Trash2 size={22} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showModal && <NewNotificationModal isDark={isDark} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchNotifications(); }}/>}
    </div>
  );
};

export default Notifications;
