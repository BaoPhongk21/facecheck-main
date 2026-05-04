import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Calendar, Download, Users, AlertCircle, Clock, CheckCircle2, Filter, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const chartData = Array.from({ length: 30 }).map((_, i) => ({
  name: `T10 ${i + 1}`,
  present: Math.floor(Math.random() * 200) + 1000,
  absent: Math.floor(Math.random() * 50) + 10,
  isWeekend: i % 7 === 5 || i % 7 === 6,
  isToday: i === 23,
}));

const ITEMS_PER_PAGE = 8;

const Attendance = () => {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('log');
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/attendance?date=${selectedDate}`);
        setAttendanceLogs(response.data);
      } catch (error) {
        console.error('Lỗi tải dữ liệu điểm danh:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [selectedDate]);

  const exportCSV = () => {
    const header = 'Nhân viên,Vai trò,Trạng thái,Giờ vào,Ghi chú,Giờ ra,Độ tin cậy\n';
    const rows = filtered.map(l => `${l.name},${l.role},${l.status === 'Present' ? 'Có mặt' : 'Đến trễ'},${l.checkIn},${l.checkInStatus},${l.checkOut},${l.conf}%`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `diem-danh-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    if (!filterStatus) return attendanceLogs;
    return attendanceLogs.filter(l => filterStatus === 'present' ? l.status === 'Present' : l.status !== 'Present');
  }, [attendanceLogs, filterStatus]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const presentCount = attendanceLogs.filter(l => l.status === 'Present').length;
  const lateCount = attendanceLogs.filter(l => l.status !== 'Present').length;

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu điểm danh...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tiêu đề */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Theo dõi điểm danh</h2>
          <p className="text-slate-500 mt-1">Xác minh sinh trắc học và nhật ký thời gian thực cho toàn bộ nhân viên.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setActiveTab('log')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'log' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Nhật ký chi tiết</button>
            <button onClick={() => setActiveTab('chart')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chart' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Biểu đồ xu hướng</button>
          </div>
          <div className="relative cursor-pointer">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            />
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
            <Download size={16} /> Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20} /></div>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold">+4%</span></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{presentCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng có mặt</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertCircle size={20} /></div>
            <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold">-2%</span></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{lateCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đến trễ / Vắng</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Clock size={20} /></div>
            <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-xs font-bold">Bình thường</span></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{attendanceLogs.length > 0 ? ((presentCount / attendanceLogs.length) * 100).toFixed(1) : 0}%</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ đúng giờ</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckCircle2 size={20} /></div>
            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs font-bold">99.9% ĐCX</span></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{attendanceLogs.length}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lượt xác minh AI</p>
        </div>
      </div>

      {activeTab === 'log' ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Bảng nhật ký */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Nhật ký điểm danh hàng ngày</h3>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 flex items-center gap-1">
                <option value="">Tất cả trạng thái</option>
                <option value="present">Có mặt</option>
                <option value="late">Đến trễ</option>
              </select>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Nhân viên</th><th className="p-4">Trạng thái</th>
                    <th className="p-4">Giờ vào</th><th className="p-4">Giờ ra</th><th className="p-4">Độ tin cậy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Không có dữ liệu</td></tr>
                  ) : paginated.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={log.avatar} alt={log.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" onError={e => e.target.src = 'https://randomuser.me/api/portraits/lego/1.jpg'} />
                          <div><div className="font-semibold text-slate-900 text-sm">{log.name}</div><div className="text-xs text-slate-500">{log.role}</div></div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${log.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                          {log.status === 'Present' ? 'Có mặt' : 'Đến trễ'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-semibold text-slate-900">{log.checkIn}</div>
                        <div className={`text-xs ${log.checkInStatus?.includes('+') ? 'text-red-500 font-medium' : 'text-slate-500'}`}>{log.checkInStatus}</div>
                      </td>
                      <td className="p-4"><div className="text-sm font-semibold text-slate-900">{log.checkOut}</div></td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${log.conf}%` }}></div></div>
                          <span className="text-sm font-bold text-blue-700">{log.conf}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>Hiển thị {Math.min((page - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} / {filtered.length} bản ghi</div>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border border-slate-200 rounded disabled:opacity-40">&lt;</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 flex items-center justify-center rounded font-medium ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 border border-slate-200 rounded disabled:opacity-40">&gt;</button>
              </div>
            </div>
          </div>

          {/* Bảng gắn cờ */}
          <div className="col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Thống kê hôm nay</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Tổng lượt điểm danh</span><span className="font-semibold">{attendanceLogs.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Đúng giờ</span><span className="font-semibold text-emerald-600">{presentCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Trễ / Vắng</span><span className="font-semibold text-red-600">{lateCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Tỷ lệ đúng giờ</span>
                  <span className="font-semibold text-blue-600">{attendanceLogs.length > 0 ? ((presentCount / attendanceLogs.length) * 100).toFixed(1) : 0}%</span></div>
              </div>
            </div>
            <div className="bg-white border border-red-100 rounded-2xl shadow-sm p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-4"><ShieldAlert size={18} className="text-red-500" /> Bản ghi bị gắn cờ</h3>
              <div className="space-y-3">
                {lateCount > 0 ? attendanceLogs.filter(l => l.status !== 'Present').slice(0, 3).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors">
                    <div className="bg-white p-2 rounded-lg text-orange-500 shadow-sm"><Clock size={16} /></div>
                    <div><h4 className="text-sm font-semibold text-orange-900">{l.name}</h4>
                      <p className="text-xs text-orange-600">Đến trễ • {l.checkIn}</p></div>
                  </div>
                )) : (
                  <div className="text-center text-sm text-slate-400 py-4">Không có bản ghi bất thường</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Biểu đồ xu hướng */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-900">Xu hướng điểm danh theo tháng</h3>
              <p className="text-xs text-slate-500 mt-1">Tổng hợp sự hiện diện trong 30 ngày qua.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600"></span> CÓ MẶT</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-200"></span> VẮNG MẶT</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="present" fill="#cbd5e1" radius={[4, 4, 0, 0]}
                  shape={props => { const { x, y, width, height, payload } = props; let fill = '#cbd5e1'; if (payload.isWeekend) fill = 'transparent'; else if (payload.isToday) fill = '#2563eb'; return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />; }}
                />
                <Bar dataKey="absent" fill="#fecaca" radius={[4, 4, 0, 0]}
                  shape={props => { const { x, y, width, height, payload } = props; if (payload.isWeekend || payload.absent < 20 || payload.isToday) return null; return <rect x={x} y={y} width={width} height={height} fill="#fecaca" rx={4} ry={4} />; }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mt-2 px-1">
            <span>01/10</span><span>15/10</span><span>Hôm nay</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
