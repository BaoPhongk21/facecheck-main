import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { Calendar, Download, Users, CheckCircle2, Clock, Fingerprint, ChevronRight, Maximize2, Video } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import useAuthStore from '../store/useAuthStore';
import EmployeeDashboard from './EmployeeDashboard';



const nowDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (user?.role === 'EMPLOYEE') {
    return <EmployeeDashboard />;
  }

  const exportReport = () => {
    const header = 'Số liệu,Giá trị\n';
    const rows = [
      `Tổng nhân viên,${stats.totalEmployees}`,
      `Có mặt hôm nay,${stats.presentToday}`,
      `Đi trễ/Vắng,${stats.lateToday + stats.absentToday}`,
      `AI quét thành công,${stats.aiScanSuccess}%`,
    ].join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bao-cao-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    aiScanSuccess: 0
  });
  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, feedRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/dashboard/stats?date=${selectedDate}`),
          axios.get(`http://localhost:5000/api/dashboard/feed?date=${selectedDate}`)
        ]);
        setStats(statsRes.data);
        setFeedData(feedRes.data);
      } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // ── Socket.io Listener ──
    const socket = io('http://localhost:5000');
    
    socket.on('attendanceUpdate', (data) => {
      console.log('📢 Real-time update:', data);
      
      // Cập nhật feedData (thêm vào đầu danh sách)
      setFeedData(prev => [data.log, ...prev].slice(0, 15));
      
      // Cập nhật stats
      setStats(prev => {
        const newStats = { ...prev };
        if (data.type === 'CHECKIN') {
          newStats.presentToday += 1;
          newStats.absentToday -= 1;
          if (data.log.status === 'LATE') {
            newStats.lateToday += 1;
          }
        }
        // Tính lại AI Scan Success (ước tính đơn giản)
        const currentConf = parseFloat(data.log.conf);
        newStats.aiScanSuccess = +((prev.aiScanSuccess * 0.9 + currentConf * 0.1)).toFixed(1);
        
        return newStats;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedDate]);

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu từ máy chủ...</div>;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tiêu đề */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng quan hệ thống</h2>
          <p className="text-slate-500 mt-1">Chào buổi sáng, Admin. Đây là hoạt động nhận diện sinh trắc học hôm nay.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative cursor-pointer">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            />
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button onClick={exportReport} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
            <Download size={16} />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng nhân viên</h3>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={18} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-2">{stats.totalEmployees}</p>
          <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
            <span className="material-icons text-xs">trending_up</span> +12 tháng này
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Có mặt hôm nay</h3>
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={18} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-2">{stats.presentToday}</p>
          <p className="text-sm text-slate-500">{stats.totalEmployees ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(1) : 0}% nhân lực hiện diện</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đi trễ / Vắng mặt</h3>
            <div className="bg-red-50 p-2 rounded-lg text-red-600"><Clock size={18} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-2">{stats.lateToday + stats.absentToday}</p>
          <p className="text-sm font-medium text-red-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> {stats.lateToday} người đến trễ
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI quét thành công</h3>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Fingerprint size={18} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-2">{stats.aiScanSuccess}%</p>
          <p className="text-sm font-medium text-blue-600 flex items-center gap-1">
            Dựa trên điểm tin cậy nhận diện
          </p>
        </div>
      </div>

      {/* Lưới giữa */}
      <div className="grid grid-cols-3 gap-6">
        {/* Feed thời gian thực */}
        <div className="col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Video size={18} className="text-blue-600" /> Điểm danh thời gian thực
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">TRỰC TIẾP</span>
          </div>
          <div className="p-2 flex-1">
            {feedData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${item.status === 'LATE' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                    <p className="text-xs text-slate-500">{item.role} • MNV: {item.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{item.time}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{item.conf} ĐTC</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${item.status === 'LATE' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.type === 'IN' ? 'VÀO' : 'RA'} - {item.status === 'LATE' ? 'TRỄ' : 'ĐÚNG GIỜ'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-100 text-center">
            <button onClick={() => navigate('/attendance')} className="text-blue-600 text-sm font-medium hover:text-blue-700">Xem tất cả lượt quét gần đây →</button>
          </div>
        </div>

        {/* Cột phải */}
        <div className="col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Biểu đồ xu hướng */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-900">Xu hướng tuần</h3>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span> Tỷ lệ hiện diện %
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trendData || []}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                    <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Thao tác nhanh */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Thao tác nhanh</h3>
              <div className="space-y-3">
                <button onClick={() => navigate('/employees')} className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Users size={18} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-semibold text-slate-900">Đăng ký khuôn mặt mới</h4>
                      <p className="text-xs text-slate-500">Ghi danh nhân viên mới vào hệ thống</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600" />
                </button>
                <button onClick={() => navigate('/attendance')} className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Calendar size={18} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-semibold text-slate-900">Xem báo cáo hôm nay</h4>
                      <p className="text-xs text-slate-500">Chi tiết điểm danh theo ca</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Camera trực tiếp */}
          <div className="relative rounded-2xl overflow-hidden shadow-md bg-slate-900 group h-48">
            <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200" alt="Camera văn phòng" className="w-full h-full object-cover opacity-60" />

            {/* Khung AI nhận diện */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 border-2 border-blue-500 bg-blue-500/10 rounded-lg relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">ĐANG NHẬN DIỆN...</div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                Camera Cổng Chính 01
              </h3>
              <p className="text-slate-300 text-xs flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Trạng thái: Đang quét
              </p>
            </div>
            <button className="absolute bottom-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-lg backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100">
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
