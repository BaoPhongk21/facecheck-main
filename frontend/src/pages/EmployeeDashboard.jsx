import { useState, useEffect } from 'react';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { Clock, Calendar, CheckCircle2, AlertCircle, Bell } from 'lucide-react';

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

  if (loading || !data) return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cột trái: Thống kê + Lịch sử */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600 w-fit mb-3"><CheckCircle2 size={20}/></div>
              <p className="text-3xl font-bold text-slate-900">{data.month.onTime}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Đúng giờ (tháng này)</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-orange-50 p-2 rounded-lg text-orange-600 w-fit mb-3"><AlertCircle size={20}/></div>
              <p className="text-3xl font-bold text-slate-900">{data.month.late}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Đi trễ (tháng này)</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Clock size={18} className="text-blue-600"/> Lịch sử điểm danh</h3>
            </div>
            {data.recent.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Chưa có lịch sử điểm danh</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {data.recent.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm font-medium text-slate-900">{new Date(log.checkTime).toLocaleString('vi-VN')}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.type === 'IN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {log.type === 'IN' ? '▶ Vào ca' : '◀ Ra ca'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-xs font-bold ${log.status === 'ON_TIME' ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {log.status === 'ON_TIME' ? 'Đúng giờ' : 'Đi trễ'}
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

        {/* Cột phải: Thông báo */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-sm shadow-blue-200 p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-semibold text-blue-100 mb-1">Trạng thái hôm nay</h3>
              <div className="text-2xl font-bold mb-4">{new Date().toLocaleDateString('vi-VN')}</div>
              {data.today.checkin ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <span className="text-sm">Vào ca</span>
                    <span className="font-bold">{new Date(data.today.checkin.time).toLocaleTimeString('vi-VN')}</span>
                  </div>
                  {data.today.checkout ? (
                    <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <span className="text-sm">Ra ca</span>
                      <span className="font-bold">{new Date(data.today.checkout.time).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  ) : (
                    <div className="text-center text-sm font-medium text-blue-100 mt-2">Đang trong ca làm việc</div>
                  )}
                </div>
              ) : (
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm text-center text-sm">Chưa ghi nhận điểm danh hôm nay</div>
              )}
            </div>
            <div className="absolute -bottom-10 -right-10 text-white/10"><Calendar size={150}/></div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Bell size={18} className="text-rose-500"/> Thông báo từ HR</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Không có thông báo mới</div>
              ) : notifications.map(n => (
                <div key={n.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{n.title}</h4>
                  <p className="text-xs text-slate-400 mb-2">{new Date(n.date).toLocaleString('vi-VN')}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{n.content}</p>
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
