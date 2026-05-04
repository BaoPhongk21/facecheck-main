import { useState, useEffect } from 'react';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { Clock, Calendar, CheckCircle2, AlertCircle, Bell, LogIn, LogOut, Fingerprint } from 'lucide-react';

const EmployeeDashboard = () => {
  const { token } = useAuthStore();
  const [data, setData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, notifRes] = await Promise.all([
          axios.get('http://localhost:5000/api/portal/me', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:5000/api/notifications')
        ]);
        setData(meRes.data);
        setNotifications(notifRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading || !data) return <div className="p-12 text-center text-slate-500 animate-pulse font-bold">Đang đồng bộ dữ liệu...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Trung tâm làm việc</h2>
          <p className="text-slate-400 mt-1 font-medium">Chào mừng trở lại! Hôm nay bạn có một ngày làm việc tuyệt vời chứ?</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl shadow-black/20">
          <Calendar className="text-indigo-400" size={20} />
          <span className="text-slate-200 font-bold">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cột trái: Thống kê + Lịch sử */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="group bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-8 rounded-[2.5rem] border border-emerald-500/20 shadow-xl shadow-emerald-500/5 hover:scale-[1.02] transition-all duration-300">
              <div className="bg-emerald-500 text-white p-4 rounded-2xl w-fit mb-6 shadow-lg shadow-emerald-500/30 group-hover:rotate-12 transition-transform">
                <CheckCircle2 size={28}/>
              </div>
              <p className="text-5xl font-black text-white mb-2 tracking-tighter">{data.month.onTime}</p>
              <p className="text-xs font-black text-emerald-400/80 uppercase tracking-[0.2em]">Đúng giờ (tháng này)</p>
            </div>
            <div className="group bg-gradient-to-br from-orange-500/20 to-orange-500/5 p-8 rounded-[2.5rem] border border-orange-500/20 shadow-xl shadow-orange-500/5 hover:scale-[1.02] transition-all duration-300">
              <div className="bg-orange-500 text-white p-4 rounded-2xl w-fit mb-6 shadow-lg shadow-orange-500/30 group-hover:-rotate-12 transition-transform">
                <AlertCircle size={28}/>
              </div>
              <p className="text-5xl font-black text-white mb-2 tracking-tighter">{data.month.late}</p>
              <p className="text-xs font-black text-orange-400/80 uppercase tracking-[0.2em]">Đi trễ (tháng này)</p>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-700/50 bg-slate-800/20 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-3 text-xl"><Clock size={24} className="text-indigo-400"/> Lịch sử điểm danh</h3>
              <button className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest bg-indigo-500/10 px-4 py-2 rounded-full transition-colors">Xem tất cả</button>
            </div>
            {data.recent.length === 0 ? (
              <div className="p-16 text-center text-slate-500 italic font-medium">Chưa ghi nhận dữ liệu điểm danh nào trong hệ thống.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700/30 bg-slate-900/20">
                      <th className="px-8 py-5">Thời gian</th>
                      <th className="px-8 py-5">Loại hình</th>
                      <th className="px-8 py-5 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {data.recent.map(log => (
                      <tr key={log.id} className="hover:bg-slate-700/20 transition-all group">
                        <td className="px-8 py-6 text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{new Date(log.checkTime).toLocaleString('vi-VN')}</td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight ${log.type === 'IN' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/5' : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'}`}>
                            {log.type === 'IN' ? '⚡ Vào ca' : '🚪 Ra ca'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`text-[11px] font-black uppercase tracking-widest ${log.status === 'ON_TIME' ? 'text-emerald-400' : 'text-rose-400'} bg-black/20 px-3 py-1 rounded-lg`}>
                            {log.status === 'ON_TIME' ? '✓ Đúng giờ' : '⚠️ Đi trễ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Trạng thái + Thông báo */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-900 rounded-[3rem] shadow-2xl shadow-indigo-500/20 p-10 text-white relative overflow-hidden group border border-white/10">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Hôm nay</span>
                <Clock size={24} className="text-white/60 animate-pulse" />
              </div>
              <h3 className="text-4xl font-black mb-8 leading-tight tracking-tighter">Thời gian<br />làm việc</h3>
              
              <div className="space-y-5">
                {data.today.checkin ? (
                  <>
                    <div className="flex justify-between items-center bg-white/10 hover:bg-white/20 p-5 rounded-2xl border border-white/10 backdrop-blur-md transition-all group/item shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-400 rounded-xl p-3 text-indigo-900 shadow-lg shadow-emerald-400/20 group-hover/item:scale-110 transition-transform"><LogIn size={20}/></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Vào ca</span>
                      </div>
                      <span className="text-2xl font-black">{new Date(data.today.checkin.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {data.today.checkout ? (
                      <div className="flex justify-between items-center bg-white/10 hover:bg-white/20 p-5 rounded-2xl border border-white/10 backdrop-blur-md transition-all group/item shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className="bg-orange-400 rounded-xl p-3 text-indigo-900 shadow-lg shadow-orange-400/20 group-hover/item:scale-110 transition-transform"><LogOut size={20}/></div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Ra ca</span>
                        </div>
                        <span className="text-2xl font-black">{new Date(data.today.checkout.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center pt-6">
                         <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 w-2/3 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse"></div>
                         </div>
                         <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400 mt-4 bg-emerald-400/10 px-4 py-1.5 rounded-full border border-emerald-400/20">Đang làm việc • {data.today.workHours || '0.0'}h</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white/10 p-8 rounded-[2rem] border border-white/10 backdrop-blur-md text-center shadow-2xl">
                    <p className="text-sm font-bold text-white/80 mb-6">Bạn chưa ghi nhận chấm công hôm nay</p>
                    <button onClick={() => window.location.href='/ai-config'} className="w-full bg-white text-indigo-700 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-xl shadow-black/20 active:scale-[0.98]">Bắt đầu điểm danh</button>
                  </div>
                )}
              </div>
            </div>
            {/* Background Decoration */}
            <div className="absolute -bottom-16 -right-16 text-white/5 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
              <Fingerprint size={280}/>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-700/50 bg-slate-800/20 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-3 text-xl"><Bell size={24} className="text-rose-500"/> Thông báo nội bộ</h3>
              <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-rose-500/20 animate-bounce">{notifications.length}</span>
            </div>
            <div className="divide-y divide-slate-700/30 max-h-[450px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-16 text-center text-slate-500 text-sm font-medium">Hệ thống hiện không có thông báo mới.</div>
              ) : notifications.map(n => (
                <div key={n.id} className="p-8 hover:bg-slate-700/20 transition-all cursor-pointer border-l-4 border-transparent hover:border-rose-500 group">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-100 text-sm group-hover:text-white transition-colors">{n.title}</h4>
                    <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 ml-4">{new Date(n.date).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 group-hover:text-slate-300 transition-colors">{n.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeDashboard;
