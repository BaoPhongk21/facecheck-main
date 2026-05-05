import { useState, useEffect, useMemo } from 'react';
import api from '../api/api';
import { io } from 'socket.io-client';
import { Calendar, Download, Users, AlertCircle, Clock, CheckCircle2, Filter, ShieldAlert, Award } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';


const ITEMS_PER_PAGE = 8;

const Attendance = () => {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualReport, setManualReport] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('log');
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get(`/attendance?date=${selectedDate}`);
        setAttendanceLogs(response.data);
      } catch (error) {
        console.error('Lỗi tải dữ liệu điểm danh:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();

    // ── Socket.io Listener ──
    const socketUrl = (api.defaults.baseURL || 'http://localhost:5000').replace('/api', '');
    console.log('🔌 Connecting to socket at:', socketUrl);
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('✅ Connected to attendance socket:', socket.id);
    });

    socket.on('attendanceUpdate', (data) => {
      console.log('📢 REAL-TIME EVENT RECEIVED:', data);
      
      const serverDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
      console.log(`Comparing view date [${selectedDate}] with today [${serverDate}]`);

      if (selectedDate === serverDate) {
        console.log('✅ Date matches, updating state...');
        // Thử dùng alert để xác nhận (chỉ dùng khi debug)
        // window.alert(`Nhận điểm danh: ${data.log.name} (${data.type})`);
        
        setAttendanceLogs(prev => {
          console.log('Current logs count:', prev.length);
          // Nếu là CHECKOUT
          if (data.type === 'CHECKOUT') {
            const exists = prev.some(l => l.id === data.log.id);
            if (exists) {
              return prev.map(l => l.id === data.log.id ? { 
                ...l, 
                checkOut: data.log.time, 
                status: data.log.status === 'EARLY_LEAVE' || data.log.status === 'Early Leave' ? 'Early Leave' : l.status,
                workHours: data.log.workHours 
              } : l);
            }
            return [{
              id: data.log.id,
              name: data.log.name,
              role: data.log.role,
              avatar: data.log.avatar,
              status: ['Early Leave', 'EARLY_LEAVE'].includes(data.log.status) ? 'Early Leave' : 'Present',
              checkIn: '--:--',
              checkInStatus: '—',
              checkOut: data.log.time,
              conf: parseFloat(data.log.conf),
              type: 'OUT'
            }, ...prev];
          }

          // Nếu là CHECKIN
          const newLog = {
            id: data.log.id,
            name: data.log.name,
            role: data.log.role,
            avatar: data.log.avatar,
            status: data.log.status === 'LATE' ? 'Late' : 'Present',
            checkIn: data.log.time,
            checkInStatus: data.log.status === 'LATE' ? 'Trễ giờ' : 'Đúng giờ',
            checkOut: '--:--',
            conf: parseFloat(data.log.conf),
            type: 'IN'
          };

          const alreadyIn = prev.some(l => l.id === data.log.id);
          if (alreadyIn) {
            return prev.map(l => l.id === data.log.id ? { ...l, ...newLog } : l);
          }
          return [newLog, ...prev];
        });
      } else {
        console.log('❌ Date mismatch, ignoring real-time update.');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket Connection Error:', err);
    });

    return () => {
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
    };
  }, [selectedDate]);


  // Tải dữ liệu biểu đồ 30 ngày từ API
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await api.get('/attendance/chart');
        setChartData(response.data);
      } catch (error) {
        console.error('Lỗi tải dữ liệu biểu đồ:', error);
        setChartData([]);
      }
    };
    fetchChartData();
  }, []);

  useEffect(() => {
    if (activeTab === 'manual') {
      setLoading(true);
      api.get('/reports/manual-on-time')
        .then(r => setManualReport(r.data)).catch(console.error).finally(() => setLoading(false));
    }
  }, [activeTab]);

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
            <button onClick={() => setActiveTab('manual')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Báo cáo đặc biệt</button>
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
          <div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20} /></div></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{presentCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng có mặt</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertCircle size={20} /></div></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{lateCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đến trễ / Vắng</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Clock size={20} /></div></div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{attendanceLogs.length > 0 ? ((presentCount / attendanceLogs.length) * 100).toFixed(1) : 0}%</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ đúng giờ</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckCircle2 size={20} /></div></div>
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
                    <th className="p-4">Giờ vào</th><th className="p-4">Giờ ra</th><th className="p-4">Tổng giờ</th><th className="p-4">Độ tin cậy</th>
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
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          ['Present', 'ON_TIME'].includes(log.status) ? 'bg-emerald-100 text-emerald-700' : 
                          ['Early Leave', 'EARLY_LEAVE'].includes(log.status) ? 'bg-blue-100 text-blue-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {['Present', 'ON_TIME'].includes(log.status) ? 'Đúng giờ' : 
                           ['Early Leave', 'EARLY_LEAVE'].includes(log.status) ? 'Về sớm' : 'Trễ giờ'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-semibold text-slate-900">{log.checkIn}</div>
                        <div className={`text-xs ${log.checkInStatus === 'Trễ giờ' ? 'text-red-500 font-medium' : 'text-slate-500'}`}>{log.checkInStatus}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-semibold text-slate-900">{log.checkOut}</div>
                        <div className={`text-xs ${log.checkOutStatus === 'Về sớm' ? 'text-blue-500 font-medium' : 'text-slate-500'}`}>{log.checkOutStatus}</div>
                      </td>
                      <td className="p-4">
                        {log.workHours ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                            <Clock size={12} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">{log.workHours}h</span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

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
      ) : activeTab === 'chart' ? (
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
          {chartData.length > 0 && (
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mt-2 px-1">
              <span>{chartData[0]?.name}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.name}</span>
              <span>Hôm nay</span>
            </div>
          )}
        </div>
      ) : (
        /* Báo cáo manual approvals */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
              <Award size={22} className="text-orange-500" /> Phân tích duyệt "Đúng giờ" đặc biệt
            </h3>
            <p className="text-sm text-slate-500 mt-1">Danh sách nhân viên thường xuyên đi muộn nhưng được Admin phê duyệt thành Đúng giờ.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Nhân viên</th>
                  <th className="p-4">Phòng ban</th>
                  <th className="p-4 text-center">Số lần được duyệt</th>
                  <th className="p-4 text-center">Tổng thời gian trễ (phút)</th>
                  <th className="p-4">Chi tiết gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualReport.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400">Không có dữ liệu phê duyệt đặc biệt nào phù hợp</td></tr>
                ) : manualReport.map(item => (
                  <tr key={item.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{item.name}</td>
                    <td className="p-4 text-sm text-slate-600">{item.dept}</td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-bold text-sm border border-orange-200">
                        {item.count} lần
                      </span>
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-700">{item.totalDelay} phút</td>
                    <td className="p-4">
                      <div className="text-xs text-slate-500">
                        {new Date(item.logs[0].checkTime).toLocaleDateString('vi-VN')} - {item.logs[0].shiftName}
                        <br /><span className="text-red-500">Trễ thực tế: {item.logs[0].delayMinutes}m</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
