import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Download, ChevronLeft, ChevronRight, DollarSign, Users, Clock, TrendingUp, CheckCircle2, AlertCircle, XCircle, Calendar as CalendarIcon, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const Payroll = () => {
  const { user, token } = useAuthStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const r = await axios.get(`http://localhost:5000/api/payroll?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(r.data);
      setSelectedDay(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, token]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const isDark = user?.role === 'EMPLOYEE';
  const payrollData = isDark ? data?.payroll?.filter(p => p.id === user.id) : data?.payroll;
  const totalPayroll = payrollData?.reduce((s, p) => s + p.totalSalary, 0) || 0;
  const totalDays = payrollData?.reduce((s, p) => s + p.daysWorked, 0) || 0;

  const renderCalendar = (employeeData) => {
    if (!employeeData?.dailyDetail) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startOffset }, (_, i) => i);
    const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const getStatusIcon = (status) => {
      if (status === 'ON_TIME') return <CheckCircle2 size={16 * zoom} className="text-white" />;
      if (status === 'LATE') return <AlertCircle size={16 * zoom} className="text-white" />;
      if (status === 'ABSENT') return <XCircle size={16 * zoom} className="text-white" />;
      return null;
    };

    const selectedDateStr = selectedDay ? `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : null;
    const selectedData = selectedDateStr ? employeeData.dailyDetail[selectedDateStr] : null;

    const cellSize = 50 * zoom;
    const fontSize = 12 * zoom;

    return (
      <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'} border p-8 rounded-[2.5rem] mt-8 backdrop-blur-xl`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-3 text-xl uppercase tracking-wider`}>
              <CalendarIcon size={24} className="text-indigo-400" /> Nhật ký điểm danh chi tiết
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-medium italic">* Phân tích dữ liệu sinh trắc học theo ngày</p>
          </div>

          <div className={`flex items-center gap-4 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} p-3 rounded-2xl border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            <ZoomOut size={16} className="text-slate-500" />
            <input
              type="range" min="0.7" max="1.5" step="0.1"
              value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <ZoomIn size={16} className="text-slate-500" />
          </div>
        </div>

        <div className="flex justify-center overflow-x-auto pb-6 custom-scrollbar">
          <div className="grid grid-cols-7 gap-3" style={{ width: 'fit-content' }}>
            {weekDays.map(d => <div key={d} className="text-center font-black text-slate-500 uppercase mb-4 tracking-widest" style={{ fontSize: `${fontSize - 2}px` }}>{d}</div>)}
            {blanks.map(b => <div key={`b-${b}`} style={{ width: `${cellSize}px`, height: `${cellSize}px` }}></div>)}
            {days.map(d => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayData = employeeData.dailyDetail[dateStr];
              const isSelected = selectedDay === d;
              const isFuture = new Date(year, month - 1, d) > now;

              let statusClasses = isDark ? 'bg-slate-900/30 border-slate-700/50 text-slate-600' : 'bg-slate-50/40 border-slate-100 text-slate-400';
              if (!isFuture && dayData?.status) {
                if (dayData.status === 'ON_TIME') statusClasses = 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20';
                else if (dayData.status === 'LATE') statusClasses = 'bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20';
                else if (dayData.status === 'ABSENT') statusClasses = 'bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/20';
              }

              return (
                <div key={d}
                  onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                  style={{ width: `${cellSize}px`, height: `${cellSize}px`, fontSize: `${fontSize}px` }}
                  className={`border rounded-2xl flex flex-col items-center justify-center relative transition-all cursor-pointer 
                    ${isSelected ? 'ring-4 ring-indigo-500/30 border-indigo-500 bg-indigo-600 text-white z-20 scale-110 shadow-2xl' : `${statusClasses} hover:scale-105 hover:z-10`}`}
                >
                  <span className="absolute top-2 left-2 font-black opacity-50" style={{ fontSize: `${fontSize - 4}px` }}>{d}</span>
                  <div className="flex items-center justify-center">
                    {(!isFuture && dayData?.status) ? getStatusIcon(dayData.status) : <div className={`w-1.5 h-1.5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'} rounded-full`}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div className={`mt-6 p-6 ${isDark ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100'} rounded-[2rem] border animate-in slide-in-from-top-4 duration-500`}>
            <div className="flex items-center justify-between mb-6">
              <span className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>Ngày {selectedDay} Tháng {month}</span>
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg ${selectedData?.status === 'ON_TIME' ? 'bg-emerald-500 text-white' : selectedData?.status === 'LATE' ? 'bg-amber-500 text-white' : selectedData?.status === 'WEEKEND' ? 'bg-slate-600 text-white' : 'bg-rose-500 text-white'}`}>
                {selectedData?.status === 'ON_TIME' ? '✓ Đúng giờ' : selectedData?.status === 'LATE' ? '⚠️ Đi trễ' : selectedData?.status === 'WEEKEND' ? '🏖 Cuối tuần' : '✘ Vắng mặt'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className={`${isDark ? 'bg-black/20' : 'bg-white'} p-5 rounded-2xl shadow-inner`}>
                <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Thời gian vào</p>
                <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedData?.checkIn ? new Date(selectedData.checkIn).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—:—'}</p>
              </div>
              <div className={`${isDark ? 'bg-black/20' : 'bg-white'} p-5 rounded-2xl shadow-inner`}>
                <p className="text-[10px] text-slate-500 font-black uppercase mb-2 tracking-widest">Thời gian ra</p>
                <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedData?.checkOut ? new Date(selectedData.checkOut).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—:—'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 justify-center border-t border-slate-700/30 pt-8">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"></div> Đúng giờ</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-500/20"></div> Đi trễ</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full shadow-lg shadow-rose-500/20"></div> Vắng mặt</div>
        </div>
      </div>
    );
  };

  if (loading) return <div className={`p-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-500'} font-black animate-pulse`}>Đang tính toán bảng lương...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight uppercase`}>{isDark ? 'Thu nhập của tôi' : 'Hệ thống tiền lương'}</h2>
          <p className="text-slate-500 mt-2 font-medium">{isDark ? 'Thống kê chi tiết thu nhập và ngày công trong tháng.' : 'Tự động hóa thanh toán dựa trên hiệu suất điểm danh AI.'}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl px-3 py-2 shadow-xl`}>
            <button onClick={prevMonth} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
            <div className={`h-6 w-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} min-w-[100px] text-center uppercase tracking-widest`}>Tháng {month} / {year}</span>
            <div className={`h-6 w-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            <button onClick={nextMonth} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronRight size={20} /></button>
          </div>
          {!isDark && (
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95">
               Xuất báo cáo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {(isDark ? [
          { label: 'Tổng thu nhập', value: fmt(totalPayroll), icon: DollarSign, color: 'blue', grad: 'from-blue-600 to-indigo-600' },
          { label: 'Ngày công thực tế', value: totalDays, icon: Clock, color: 'emerald', grad: 'from-emerald-600 to-teal-600' },
          { label: 'Điểm danh đúng giờ', value: payrollData?.[0]?.onTime || 0, icon: CheckCircle2, color: 'indigo', grad: 'from-indigo-600 to-purple-600' },
          { label: 'Số lần đi muộn', value: payrollData?.[0]?.late || 0, icon: AlertCircle, color: 'amber', grad: 'from-amber-600 to-orange-600' },
        ] : [
          { label: 'Tổng quỹ lương', value: fmt(totalPayroll), icon: DollarSign, color: 'blue', grad: 'from-blue-600 to-indigo-600' },
          { label: 'Số lượng nhân viên', value: payrollData?.length || 0, icon: Users, color: 'emerald', grad: 'from-emerald-600 to-teal-600' },
          { label: 'Tổng ngày công', value: totalDays, icon: Clock, color: 'slate', grad: 'from-slate-600 to-slate-800' },
          { label: 'Lương trung bình', value: payrollData?.length ? fmt(totalPayroll / payrollData.length) : '—', icon: TrendingUp, color: 'purple', grad: 'from-purple-600 to-pink-600' },
        ]).map(s => (
          <div key={s.label} className={`${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'} border p-8 rounded-[2.5rem] relative overflow-hidden group hover:scale-[1.02] transition-all`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${s.grad} opacity-10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700`}></div>
            <div className={`bg-gradient-to-br ${s.grad} p-3 rounded-2xl text-white w-fit mb-6 shadow-lg relative z-10`}>
              <s.icon size={24} />
            </div>
            <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1 tracking-tighter relative z-10`}>{s.value}</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10">{s.label}</p>
          </div>
        ))}
      </div>

      {isDark && payrollData?.[0] && renderCalendar(payrollData[0])}

      <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'} border rounded-[2.5rem] overflow-hidden backdrop-blur-xl`}>
        <div className={`p-8 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-100 bg-slate-50/50'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div>
            <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-3 text-lg uppercase tracking-wider`}><FileText size={24} className="text-indigo-400"/> Bảng kê chi tiết</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Đơn giá định mức: 100.000 VNĐ / Giờ chuẩn</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`${isDark ? 'bg-slate-900/40 border-slate-700/30' : 'bg-slate-50/50 border-slate-100'} border-b text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]`}>
                <th className="px-8 py-5">Nhân viên</th>
                <th className="px-8 py-5 text-center">Ngày công</th>
                <th className="px-8 py-5 text-center">Đúng giờ</th>
                <th className="px-8 py-5 text-center">Trễ</th>
                <th className="px-8 py-5 text-right">Giờ chuẩn</th>
                <th className="px-8 py-5 text-right">Lương cơ bản</th>
                <th className="px-8 py-5 text-right">Tổng lương</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
              {!payrollData?.length ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center text-slate-500 italic font-medium">Không tìm thấy dữ liệu bảng lương tháng này.</td></tr>
              ) : payrollData.map(p => (
                <tr key={p.id} className={`${isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'} transition-all group`}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.fullName} className={`w-10 h-10 rounded-xl object-cover border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'} group-hover:border-indigo-500 transition-colors`}/>
                      ) : (
                        <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-indigo-50 text-indigo-700'} flex items-center justify-center font-black text-xs border ${isDark ? 'border-slate-600' : 'border-indigo-100'}`}>
                          {p.fullName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'} text-sm group-hover:text-white transition-colors`}>{p.fullName}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{p.department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-700' : 'border-slate-200'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {p.daysWorked}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                      {p.onTime} lần
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                      {p.late} lần
                    </span>
                  </td>
                  <td className={`px-8 py-6 text-right font-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{p.standardHours}h</td>
                  <td className={`px-8 py-6 text-right font-bold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(p.baseSalary)}</td>
                  <td className="px-8 py-6 text-right">
                    <div className={`inline-block px-4 py-2 rounded-xl ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'} font-black text-sm border ${isDark ? 'border-indigo-500/20' : 'border-indigo-100'}`}>
                      {fmt(p.totalSalary)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
