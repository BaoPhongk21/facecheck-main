import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Mail, Phone, Building2, ShieldCheck, ShieldX, Clock, CheckCircle2, Calendar, Fingerprint, TrendingUp } from 'lucide-react';

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/employees/${id}`)
      .then(r => setProfile(r.data))
      .catch(() => setError('Không tìm thấy nhân viên'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải hồ sơ...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const { stats, recentLogs } = profile;
  const onTimePct = stats.totalDays > 0 ? ((stats.onTime / stats.totalDays) * 100).toFixed(0) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Nút quay lại */}
      <button onClick={() => navigate('/employees')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
        <ArrowLeft size={18} /> Quay lại danh sách
      </button>

      {/* Header hồ sơ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-5 -mt-10 mb-5">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt={profile.fullName} className="w-20 h-20 rounded-2xl border-4 border-white object-cover shadow-md" />
              : <div className="w-20 h-20 rounded-2xl border-4 border-white bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl shadow-md">
                  {profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
            }
            <div className="pb-1">
              <h2 className="text-2xl font-bold text-slate-900">{profile.fullName}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-slate-500">MNV: <b>{profile.employeeCode}</b></span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${profile.faceEnrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {profile.faceEnrolled ? <><ShieldCheck size={12}/> Đã đăng ký khuôn mặt</> : <><ShieldX size={12}/> Chưa đăng ký</>}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            {profile.email && <div className="flex items-center gap-2 text-slate-600"><Mail size={16} className="text-slate-400"/>{profile.email}</div>}
            {profile.phone && <div className="flex items-center gap-2 text-slate-600"><Phone size={16} className="text-slate-400"/>{profile.phone}</div>}
            <div className="flex items-center gap-2 text-slate-600"><Building2 size={16} className="text-slate-400"/>{profile.department}</div>
          </div>
        </div>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Ngày đi làm', value: stats.totalDays, icon: Calendar, color: 'blue' },
          { label: 'Đúng giờ', value: stats.onTime, icon: CheckCircle2, color: 'emerald' },
          { label: 'Đi trễ', value: stats.late, icon: Clock, color: 'red' },
          { label: 'Tổng giờ làm', value: `${stats.totalHours}h`, icon: TrendingUp, color: 'purple' },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`bg-${s.color}-50 p-2 rounded-lg text-${s.color}-600 w-fit mb-3`}><s.icon size={20}/></div>
            <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tỷ lệ đúng giờ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Fingerprint size={18} className="text-blue-600"/>Tỷ lệ đúng giờ</h3>
          <span className="text-xl font-bold text-blue-700">{onTimePct}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700" style={{ width: `${onTimePct}%` }}></div>
        </div>
      </div>

      {/* Lịch sử điểm danh */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Lịch sử điểm danh gần đây</h3>
        </div>
        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Chưa có dữ liệu điểm danh</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Thời gian</th>
                <th className="p-4">Loại</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Độ tin cậy AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-700">{new Date(log.checkTime).toLocaleString('vi-VN')}</td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.type === 'IN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {log.type === 'IN' ? '▶ Vào' : '◀ Ra'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.status === 'ON_TIME' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {log.status === 'ON_TIME' ? 'Đúng giờ' : 'Đi trễ'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-semibold text-blue-700">
                    {log.confidenceScore ? `${(log.confidenceScore * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmployeeProfile;
