import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Clock, X, AlertCircle } from 'lucide-react';

const COLOR_MAP = { blue: 'bg-blue-100 text-blue-700 border-blue-200', emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200', purple: 'bg-purple-100 text-purple-700 border-purple-200', orange: 'bg-orange-100 text-orange-700 border-orange-200', red: 'bg-red-100 text-red-700 border-red-200' };

const ShiftModal = ({ shift, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', startTime: '08:00', endTime: '17:00', color: 'blue', lateAfterMinutes: 15, ...(shift || {}) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Vui lòng nhập tên ca'); return; }
    setLoading(true);
    try {
      if (shift) await axios.put(`http://localhost:5000/api/shifts/${shift.id}`, form);
      else await axios.post('http://localhost:5000/api/shifts', form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi lưu ca');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{shift ? 'Chỉnh sửa ca' : 'Thêm ca làm việc'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên ca *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="VD: Ca sáng"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Giờ bắt đầu</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Giờ kết thúc</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cho phép trễ (phút)</label>
            <input type="number" min={0} max={60} value={form.lateAfterMinutes} onChange={e => setForm(f => ({...f, lateAfterMinutes: +e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Màu sắc</label>
            <div className="flex gap-2">
              {Object.keys(COLOR_MAP).map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({...f, color: c}))}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-slate-900 scale-110' : 'border-transparent'} ${COLOR_MAP[c].split(' ')[0]}`}/>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors">Hủy</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60">
              {loading ? 'Đang lưu...' : shift ? '✓ Cập nhật' : '+ Thêm ca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Shifts = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | shift object

  const fetchShifts = () => {
    setLoading(true);
    axios.get('http://localhost:5000/api/shifts').then(r => setShifts(r.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchShifts(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa ca làm việc này?')) return;
    await axios.delete(`http://localhost:5000/api/shifts/${id}`);
    fetchShifts();
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý ca làm việc</h2>
          <p className="text-slate-500 mt-1">Định nghĩa các ca làm việc và thời gian cho phép trễ.</p>
        </div>
        <button onClick={() => setModal('add')} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
          <Plus size={16}/> Thêm ca mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {shifts.map(shift => (
          <div key={shift.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden border-slate-200`}>
            <div className={`h-2 ${shift.color === 'blue' ? 'bg-blue-500' : shift.color === 'emerald' ? 'bg-emerald-500' : shift.color === 'purple' ? 'bg-purple-500' : shift.color === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{shift.name}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border mt-1 ${COLOR_MAP[shift.color] || COLOR_MAP.blue}`}>
                    <Clock size={11}/> {shift.startTime} – {shift.endTime}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(shift)} className="p-1.5 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors text-slate-400"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(shift.id)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-slate-400"><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Thời gian làm việc</span>
                  <span className="font-semibold">{(() => { 
                    const [sh,sm] = shift.startTime.split(':').map(Number); 
                    const [eh,em] = shift.endTime.split(':').map(Number); 
                    let duration = (eh * 60 + em) - (sh * 60 + sm);
                    if (duration < 0) duration += 1440;
                    return `${duration} phút`; 
                  })()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cho phép trễ</span>
                  <span className="font-semibold text-orange-600">{shift.lateAfterMinutes} phút</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {shifts.length === 0 && <div className="col-span-3 p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">Chưa có ca làm việc nào. Nhấn "+ Thêm ca mới" để bắt đầu.</div>}
      </div>

      {modal && <ShiftModal shift={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchShifts(); }}/>}
    </div>
  );
};

export default Shifts;
