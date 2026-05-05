import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, XCircle, Clock, X, AlertCircle, FileText } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS = {
  pending: { label: 'Chờ duyệt', cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Từ chối', cls: 'bg-red-100 text-red-700' },
};

const NewExceptionModal = ({ onClose, onSaved, user }) => {
  const [form, setForm] = useState({ 
    type: 'IN', 
    checkTime: '', reason: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.checkTime) { setError('Vui lòng chọn thời gian'); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (user?.role === 'EMPLOYEE') {
        payload.employeeId = user.id;
      } else {
        // Admin creates for employee - Not fully supported without employee select
        setError('Chỉ nhân viên mới có thể tạo yêu cầu từ portal');
        setLoading(false);
        return;
      }
      await axios.post('http://localhost:5000/api/exceptions', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi yêu cầu');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Báo quên / Bổ sung điểm danh</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Loại điểm danh</label>
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="IN">Check-in (Vào làm)</option>
              <option value="OUT">Check-out (Tan làm)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thời gian thực tế *</label>
            <input type="datetime-local" value={form.checkTime} onChange={e => setForm(f => ({...f, checkTime: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lý do quên/Lỗi hệ thống</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" placeholder="Ví dụ: AI không nhận dạng được lúc 8h sáng..."/>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors">Hủy</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60">
              {loading ? 'Đang gửi...' : '📩 Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Exceptions = () => {
  const { user, token } = useAuthStore();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchExceptions = () => {
    setLoading(true);
    axios.get('http://localhost:5000/api/exceptions', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => setExceptions(r.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchExceptions(); }, []);

  const handleApprove = async (id) => {
    await axios.put(`http://localhost:5000/api/exceptions/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchExceptions();
  };
  const handleReject = async (id) => {
    await axios.put(`http://localhost:5000/api/exceptions/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchExceptions();
  };

  const myExceptions = user?.role === 'EMPLOYEE' ? exceptions.filter(l => l.employeeId === user.id) : exceptions;

  const pending = myExceptions.filter(l => l.status === 'pending').length;
  const approved = myExceptions.filter(l => l.status === 'approved').length;
  const rejected = myExceptions.filter(l => l.status === 'rejected').length;
  const filtered = filterStatus ? myExceptions.filter(l => l.status === filterStatus) : myExceptions;

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.role === 'EMPLOYEE' ? 'Yêu cầu điểm danh bổ sung' : 'Duyệt yêu cầu điểm danh'}</h2>
          <p className="text-slate-500 mt-1">{user?.role === 'EMPLOYEE' ? 'Tạo yêu cầu nếu bạn quên chấm công hoặc AI gặp lỗi.' : 'Xem xét và phê duyệt các yêu cầu bổ sung điểm danh.'}</p>
        </div>
        {user?.role === 'EMPLOYEE' && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
            <Plus size={16}/> Tạo yêu cầu
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Chờ duyệt', count: pending, icon: Clock, cls: 'bg-yellow-50 text-yellow-600 border-yellow-200', filter: 'pending' },
          { label: 'Đã duyệt', count: approved, icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', filter: 'approved' },
          { label: 'Từ chối', count: rejected, icon: XCircle, cls: 'bg-red-50 text-red-600 border-red-200', filter: 'rejected' },
        ].map(s => (
          <button key={s.filter} onClick={() => setFilterStatus(filterStatus === s.filter ? '' : s.filter)}
            className={`bg-white p-5 rounded-2xl border shadow-sm text-left transition-all ${filterStatus === s.filter ? 'ring-2 ring-blue-400' : ''} ${s.cls}`}>
            <div className="flex items-center justify-between mb-3">
              <s.icon size={22}/>
            </div>
            <p className="text-3xl font-bold">{s.count}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1 opacity-70">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={18} className="text-blue-600"/> Danh sách yêu cầu</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Nhân viên</th>
                <th className="p-4">Loại</th>
                <th className="p-4">Thời gian báo cáo</th>
                <th className="p-4">Lý do</th>
                <th className="p-4">Trạng thái</th>
                {user?.role !== 'EMPLOYEE' && <th className="p-4 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có yêu cầu nào</td></tr>
              ) : filtered.map(exc => (
                <tr key={exc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {exc.avatarUrl ? <img src={exc.avatarUrl} alt={exc.employeeName} className="w-9 h-9 rounded-full object-cover border border-slate-200"/> : <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">{exc.employeeName.split(' ').map(n=>n[0]).join('').substring(0,2)}</div>}
                      <div className="font-semibold text-slate-900 text-sm">{exc.employeeName}</div>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-semibold">{exc.type === 'IN' ? 'Check-in' : 'Check-out'}</td>
                  <td className="p-4 text-sm text-slate-700">{new Date(exc.checkTime).toLocaleString('vi-VN')}</td>
                  <td className="p-4 text-sm text-slate-600 max-w-[160px] truncate">{exc.reason || '—'}</td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS[exc.status]?.cls}`}>
                      {STATUS[exc.status]?.label}
                    </span>
                  </td>
                  {user?.role !== 'EMPLOYEE' && (
                    <td className="p-4">
                      {exc.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleApprove(exc.id)} title="Duyệt" className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"><CheckCircle size={16}/></button>
                          <button onClick={() => handleReject(exc.id)} title="Từ chối" className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"><XCircle size={16}/></button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-300 text-xs">—</div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <NewExceptionModal user={user} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchExceptions(); }}/>}
    </div>
  );
};

export default Exceptions;
