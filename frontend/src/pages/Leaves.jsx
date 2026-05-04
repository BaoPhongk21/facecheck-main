import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, XCircle, Clock, X, AlertCircle, FileText, Calendar } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS = {
  pending: { label: 'Chờ duyệt', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected: { label: 'Từ chối', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

const LEAVE_TYPES = ['Nghỉ phép năm', 'Nghỉ bệnh', 'Nghỉ không lương', 'Nghỉ thai sản', 'Nghỉ lễ bù'];

const NewLeaveModal = ({ onClose, onSaved, user }) => {
  const [form, setForm] = useState({ 
    employeeName: user?.role === 'EMPLOYEE' ? user.fullName : '', 
    type: 'Nghỉ phép năm', 
    from: '', to: '', reason: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employeeName || !form.from || !form.to) { setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return; }
    setLoading(true);
    try {
      const from = new Date(form.from), to = new Date(form.to);
      const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
      const payload = { ...form, days };
      if (user?.role === 'EMPLOYEE') {
        payload.employeeId = user.id;
        payload.avatarUrl = user.avatarUrl;
      }
      await axios.post('http://localhost:5000/api/leaves', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi đơn');
    } finally { setLoading(false); }
  };

  const isDark = user?.role === 'EMPLOYEE';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className={`${isDark ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-100'} border rounded-[2.5rem] shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-300 overflow-hidden`}>
        <div className={`px-8 py-6 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-100 bg-slate-50'} flex items-center justify-between`}>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider`}>Gửi đơn xin nghỉ phép</h2>
          <button onClick={onClose} className={`p-2 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} rounded-full transition-colors`}><X size={24}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && <div className={`p-4 ${isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-red-50 text-red-600 border-red-100'} border rounded-2xl text-xs font-bold flex items-center gap-3 animate-pulse`}><AlertCircle size={18}/>{error}</div>}
          
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Tên nhân viên *</label>
            <input 
              value={form.employeeName} 
              onChange={e => setForm(f => ({...f, employeeName: e.target.value}))} 
              disabled={user?.role === 'EMPLOYEE'}
              className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 outline-none transition-all`} 
            />
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Loại nghỉ phép</label>
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none`}>
              {LEAVE_TYPES.map(t => <option key={t} className={isDark ? 'bg-slate-800' : ''}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Từ ngày *</label>
              <input type="date" value={form.from} onChange={e => setForm(f => ({...f, from: e.target.value}))} className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all`}/>
            </div>
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Đến ngày *</label>
              <input type="date" value={form.to} onChange={e => setForm(f => ({...f, to: e.target.value}))} className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all`}/>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Lý do xin nghỉ</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} rows={3} className={`w-full px-5 py-4 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none`} placeholder="Tại sao bạn cần nghỉ phép?"/>
          </div>

          <div className="flex gap-4 justify-end pt-4">
            <button type="button" onClick={onClose} className={`px-8 py-4 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} font-black text-xs uppercase tracking-widest rounded-2xl transition-all`}>Hủy</button>
            <button type="submit" disabled={loading} className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50">
              {loading ? 'Đang xử lý...' : '📩 Gửi đơn ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Leaves = () => {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const r = await axios.get('http://localhost:5000/api/leaves');
      setLeaves(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApprove = async (id) => {
    await axios.put(`http://localhost:5000/api/leaves/${id}/approve`);
    fetchLeaves();
  };
  const handleReject = async (id) => {
    await axios.put(`http://localhost:5000/api/leaves/${id}/reject`);
    fetchLeaves();
  };

  const isDark = user?.role === 'EMPLOYEE';
  const myLeaves = isDark ? leaves.filter(l => l.employeeId === user.id) : leaves;

  const pending = myLeaves.filter(l => l.status === 'pending').length;
  const approved = myLeaves.filter(l => l.status === 'approved').length;
  const rejected = myLeaves.filter(l => l.status === 'rejected').length;
  const filtered = filterStatus ? myLeaves.filter(l => l.status === filterStatus) : myLeaves;

  if (loading) return <div className={`p-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-500'} font-black animate-pulse`}>Đang đồng bộ dữ liệu nghỉ phép...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight uppercase`}>{isDark ? 'Quản lý phép cá nhân' : 'Phê duyệt nghỉ phép'}</h2>
          <p className="text-slate-500 mt-1 font-medium">{isDark ? 'Theo dõi tiến độ và lịch sử các đơn xin nghỉ của bạn.' : 'Quản lý tập trung các yêu cầu nghỉ phép từ nhân viên.'}</p>
        </div>
        {isDark && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98]">
            <Plus size={20}/> Gửi đơn nghỉ phép
          </button>
        )}
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Chờ duyệt', count: pending, icon: Clock, accent: 'from-yellow-500/20 to-yellow-500/5', iconCls: 'bg-yellow-500 text-white', textCls: 'text-yellow-400', filter: 'pending' },
          { label: 'Đã duyệt', count: approved, icon: CheckCircle, accent: 'from-emerald-500/20 to-emerald-500/5', iconCls: 'bg-emerald-500 text-white', textCls: 'text-emerald-400', filter: 'approved' },
          { label: 'Từ chối', count: rejected, icon: XCircle, accent: 'from-rose-500/20 to-rose-500/5', iconCls: 'bg-rose-500 text-white', textCls: 'text-rose-400', filter: 'rejected' },
        ].map(s => (
          <button key={s.filter} onClick={() => setFilterStatus(filterStatus === s.filter ? '' : s.filter)}
            className={`group relative overflow-hidden ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-100'} border p-8 rounded-[2.5rem] text-left transition-all hover:scale-[1.02] ${filterStatus === s.filter ? 'ring-2 ring-indigo-500 shadow-2xl' : 'shadow-xl shadow-black/5'}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${s.accent} rounded-full -mr-16 -mt-16 blur-2xl opacity-50`}></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className={`${s.iconCls} p-3 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform`}>
                <s.icon size={24}/>
              </div>
              {filterStatus === s.filter && <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-white px-3 py-1 rounded-full animate-pulse">Đang lọc</span>}
            </div>
            <p className={`text-5xl font-black ${isDark ? 'text-white' : 'text-slate-900'} relative z-10 tracking-tighter`}>{s.count}</p>
            <p className={`text-xs font-black uppercase tracking-[0.2em] mt-2 ${s.textCls} relative z-10`}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Danh sách đơn */}
      <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'} border rounded-[2.5rem] overflow-hidden backdrop-blur-xl`}>
        <div className={`p-8 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-100 bg-slate-50/50'} flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-3 text-lg uppercase tracking-wider`}><FileText size={24} className="text-indigo-400"/> Danh sách đơn</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">Lọc:</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`flex-1 sm:flex-none px-5 py-2.5 ${isDark ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} border rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20`}>
              <option value="">Tất cả trạng thái</option>
              <option value="pending">⏳ Chờ duyệt</option>
              <option value="approved">✅ Đã duyệt</option>
              <option value="rejected">❌ Từ chối</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`${isDark ? 'bg-slate-900/40 border-slate-700/30' : 'bg-slate-50/50 border-slate-100'} border-b text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]`}>
                <th className="px-8 py-5">Nhân viên</th>
                <th className="px-8 py-5">Loại phép</th>
                <th className="px-8 py-5">Thời gian</th>
                <th className="px-8 py-5">Số ngày</th>
                <th className="px-8 py-5">Lý do</th>
                <th className="px-8 py-5">Trạng thái</th>
                {user?.role !== 'EMPLOYEE' && <th className="px-8 py-5 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center text-slate-500 italic font-medium">Không tìm thấy dữ liệu đơn nghỉ phép nào.</td></tr>
              ) : filtered.map(leave => (
                <tr key={leave.id} className={`${isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'} transition-all group`}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      {leave.avatarUrl ? (
                        <img src={leave.avatarUrl} alt={leave.employeeName} className={`w-10 h-10 rounded-xl object-cover border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'} group-hover:border-indigo-500 transition-colors`}/>
                      ) : (
                        <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-indigo-50 text-indigo-700'} flex items-center justify-center font-black text-xs border ${isDark ? 'border-slate-600' : 'border-indigo-100'}`}>
                          {leave.employeeName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                      )}
                      <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'} text-sm group-hover:text-white transition-colors`}>{leave.employeeName}</div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-indigo-400 bg-indigo-500/10' : 'text-indigo-600 bg-indigo-50'} px-3 py-1 rounded-lg`}>
                      {leave.type}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-2`}><Calendar size={14} className="text-slate-500"/> {leave.from}</div>
                    {leave.from !== leave.to && <div className="text-[10px] text-slate-500 font-bold ml-5">đến {leave.to}</div>}
                  </td>
                  <td className="px-8 py-6">
                    <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{leave.days}</span>
                      <span className="text-[8px] font-black uppercase text-slate-500">Ngày</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} italic line-clamp-2 max-w-[200px]`}>"{leave.reason || 'Không có lý do'}"</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-4 py-2 rounded-xl border ${STATUS[leave.status]?.cls}`}>
                      {STATUS[leave.status]?.label}
                    </span>
                  </td>
                  {user?.role !== 'EMPLOYEE' && (
                    <td className="px-8 py-6">
                      {leave.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => handleApprove(leave.id)} title="Duyệt" className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all shadow-lg shadow-emerald-500/5 active:scale-90"><CheckCircle size={18}/></button>
                          <button onClick={() => handleReject(leave.id)} title="Từ chối" className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all shadow-lg shadow-rose-500/5 active:scale-90"><XCircle size={18}/></button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-30">Đã chốt</div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <NewLeaveModal user={user} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchLeaves(); }}/>}
    </div>
  );
};

export default Leaves;
