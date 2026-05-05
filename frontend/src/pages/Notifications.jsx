import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Bell, X, AlertCircle } from 'lucide-react';

const NewNotificationModal = ({ onClose, onSaved }) => {
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Tạo thông báo mới</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tiêu đề thông báo *</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Ví dụ: Lịch nghỉ lễ 30/4"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nội dung chi tiết *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({...f, content: e.target.value}))} rows={5} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" placeholder="Nhập nội dung thông báo gửi đến nhân viên..."/>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors">Hủy</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2">
              {loading ? 'Đang gửi...' : <><Bell size={16}/> Gửi thông báo</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    axios.get('http://localhost:5000/api/notifications')
      .then(r => setNotifications(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/notifications/${id}`);
      fetchNotifications();
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý Thông báo</h2>
          <p className="text-slate-500 mt-1">Gửi và quản lý các thông báo quan trọng đến toàn bộ nhân viên.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
          <Plus size={16}/> Tạo thông báo
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Bell size={18} className="text-blue-600"/> Danh sách thông báo đã gửi</h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Bell size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Chưa có thông báo nào</h3>
              <p className="text-slate-500 text-sm">Hãy tạo thông báo đầu tiên để gửi đến nhân viên.</p>
            </div>
          ) : notifications.map((n) => (
            <div key={n.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start justify-between gap-6">
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-lg mb-1">{n.title}</h4>
                <p className="text-xs text-slate-400 font-medium mb-3">Gửi lúc: {new Date(n.date).toLocaleString('vi-VN')}</p>
                <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 p-4 rounded-xl shadow-sm">{n.content}</p>
              </div>
              <button 
                onClick={() => handleDelete(n.id)} 
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Xóa thông báo"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showModal && <NewNotificationModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchNotifications(); }}/>}
    </div>
  );
};

export default Notifications;
