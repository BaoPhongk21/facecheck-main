import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, ChevronLeft, ChevronRight, DollarSign, Users, Clock, TrendingUp, CheckCircle2, AlertCircle, XCircle, Calendar as CalendarIcon, ZoomIn, ZoomOut } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const Payroll = () => {
  const { user, token } = useAuthStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1); // 0.8 đến 1.5
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`http://localhost:5000/api/payroll?month=${month}&year=${year}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { setData(r.data); setSelectedDay(null); }).catch(console.error).finally(() => setLoading(false));
  }, [month, year, token]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const exportCSV = () => {
    if (!payrollData) return;
    const header = 'Mã NV,Họ tên,Phòng ban,Ngày công,Giờ chuẩn,OT,Lương cơ bản,Tổng lương\n';
    const rows = payrollData.map(p => `${p.employeeCode},${p.fullName},${p.department},${p.daysWorked},${p.standardHours},${p.overtimeHours},${p.baseSalary},${p.totalSalary}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `luong-${month}-${year}.csv`; a.click();
  };

  const payrollData = user?.role === 'EMPLOYEE' ? data?.payroll?.filter(p => p.id === user.id) : data?.payroll;
  const totalPayroll = payrollData?.reduce((s, p) => s + p.totalSalary, 0) || 0;
  const totalDays = payrollData?.reduce((s, p) => s + p.daysWorked, 0) || 0;

  // Logic hiển thị lịch
  const renderCalendar = (employeeData) => {
    if (!employeeData?.dailyDetail) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0: CN, 1: T2...
    // Chuyển về 0: T2, 6: CN để khớp mảng
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startOffset }, (_, i) => i);
    const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const getStatusIcon = (status, isHighContrast = false) => {
      const colorClass = isHighContrast ? "text-white" : "";
      if (status === 'ON_TIME') return <CheckCircle2 size={16} className={colorClass || "text-emerald-500"} />;
      if (status === 'LATE') return <AlertCircle size={16} className={colorClass || "text-yellow-500"} />;
      if (status === 'ABSENT') return <XCircle size={16} className={colorClass || "text-red-500"} />;
      return null;
    };

    const selectedDateStr = selectedDay ? `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : null;
    const selectedData = selectedDateStr ? employeeData.dailyDetail[selectedDateStr] : null;

    const cellSize = 40 * zoom;
    const iconSize = 18 * zoom;
    const fontSize = 11 * zoom;

    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
              <CalendarIcon size={20} className="text-blue-600" /> Chi tiết điểm danh tháng {month}/{year}
            </h3>
            <p className="text-xs text-slate-500 mt-1 italic">* Dữ liệu được tổng hợp từ máy quét AI</p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <ZoomOut size={16} className="text-slate-400" />
            <input
              type="range" min="0.7" max="1.5" step="0.1"
              value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <ZoomIn size={16} className="text-slate-400" />
          </div>
        </div>

        <div className="flex justify-center overflow-x-auto pb-4">
          <div className="grid grid-cols-7 gap-1.5" style={{ width: 'fit-content' }}>
            {weekDays.map(d => <div key={d} className="text-center font-bold text-slate-400 uppercase mb-2" style={{ fontSize: `${fontSize - 1}px` }}>{d}</div>)}
            {blanks.map(b => <div key={`b-${b}`} style={{ width: `${cellSize}px`, height: `${cellSize}px` }}></div>)}
            {days.map(d => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayData = employeeData.dailyDetail[dateStr];
              const isSelected = selectedDay === d;
              const isFuture = new Date(year, month - 1, d) > now;

              // Xác định màu nền đậm hơn dựa trên trạng thái
              let statusClasses = 'bg-slate-50/40 border-slate-100';
              if (!isFuture && dayData?.status) {
                if (dayData.status === 'ON_TIME') statusClasses = 'bg-emerald-500 border-emerald-600 text-white';
                else if (dayData.status === 'LATE') statusClasses = 'bg-yellow-500 border-yellow-600 text-white';
                else if (dayData.status === 'ABSENT') statusClasses = 'bg-red-500 border-red-600 text-white';
              }

              return (
                <div key={d}
                  onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                  style={{ width: `${cellSize}px`, height: `${cellSize}px`, fontSize: `${fontSize}px` }}
                  className={`border rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer shadow-sm 
                    ${isSelected ? 'border-blue-600 bg-blue-100 shadow-md ring-2 ring-blue-300 z-20 scale-110' : `${statusClasses} hover:brightness-95 hover:shadow-md hover:border-slate-300`}`}
                >
                  <span className={`absolute top-1 left-1 font-bold ${isSelected ? 'text-blue-700' : (!isFuture && dayData?.status ? 'text-white' : 'text-slate-400 opacity-60')}`} style={{ fontSize: `${fontSize - 2}px` }}>{d}</span>
                  <div className="mt-1 flex items-center justify-center">
                    {(!isFuture && dayData?.status) ? getStatusIcon(dayData.status, true) : <span className="w-1 h-1 bg-slate-200 rounded-full"></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel chi tiết khi click */}
        {selectedDay && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-700">Chi tiết ngày {selectedDay}/{month}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${selectedData?.status === 'ON_TIME' ? 'bg-emerald-100 text-emerald-700' : selectedData?.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {selectedData?.status === 'ON_TIME' ? 'Đúng giờ' : selectedData?.status === 'LATE' ? 'Đi trễ' : selectedData?.status === 'WEEKEND' ? 'Cuối tuần' : 'Vắng mặt'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ vào làm</p>
                <p className="text-sm font-bold text-slate-900">{selectedData?.checkIn ? new Date(selectedData.checkIn).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ tan làm</p>
                <p className="text-sm font-bold text-slate-900">{selectedData?.checkOut ? new Date(selectedData.checkOut).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 justify-center border-t border-slate-50 pt-4">
          <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Đúng giờ</div>
          <div className="flex items-center gap-1"><AlertCircle size={12} className="text-yellow-500" /> Đi trễ</div>
          <div className="flex items-center gap-1"><XCircle size={12} className="text-red-500" /> Vắng mặt</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.role === 'EMPLOYEE' ? 'Lương của tôi' : 'Bảng lương'}</h2>
          <p className="text-slate-500 mt-1">{user?.role === 'EMPLOYEE' ? 'Chi tiết lương thưởng trong tháng của bạn.' : 'Tính toán lương tự động dựa trên dữ liệu điểm danh thực tế.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronLeft size={18} /></button>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="text-sm font-semibold text-slate-900 bg-transparent border-none focus:ring-0 cursor-pointer py-1 px-1"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-sm font-semibold text-slate-900 bg-transparent border-none focus:ring-0 cursor-pointer py-1 px-1"
            >
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronRight size={18} /></button>
          </div>
          {user?.role !== 'EMPLOYEE' && (
            <button onClick={exportCSV} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
              <Download size={16} /> Xuất Excel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {(user?.role === 'EMPLOYEE' ? [
          { label: 'Tổng lương nhận', value: fmt(totalPayroll), icon: DollarSign, color: 'blue' },
          { label: 'Tổng ngày công', value: totalDays, icon: Clock, color: 'slate' },
          { label: 'Đúng giờ', value: payrollData?.[0]?.onTime || 0, icon: CheckCircle2, color: 'emerald' },
          { label: 'Đi trễ', value: payrollData?.[0]?.late || 0, icon: AlertCircle, color: 'orange' },
        ] : [
          { label: 'Tổng quỹ lương', value: fmt(totalPayroll), icon: DollarSign, color: 'blue' },
          { label: 'Nhân viên', value: payrollData?.length || 0, icon: Users, color: 'emerald' },
          { label: 'Tổng ngày công', value: totalDays, icon: Clock, color: 'slate' },
          { label: 'Lương trung bình', value: payrollData?.length ? fmt(totalPayroll / payrollData.length) : '—', icon: TrendingUp, color: 'purple' },
        ]).map(s => (
          <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`bg-${s.color}-50 p-2 rounded-lg text-${s.color}-600 w-fit mb-3`}><s.icon size={20} /></div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Hiển thị lịch cho nhân viên */}
      {user?.role === 'EMPLOYEE' && payrollData?.[0] && (
        renderCalendar(payrollData[0])
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Chi tiết — Tháng {month}/{year}</h3>
          <p className="text-xs text-slate-500 mt-1">Đơn giá: 100.000 VNĐ/giờ · Làm thêm giờ: x1</p>
        </div>
        {loading ? <div className="p-8 text-center text-slate-500">Đang tính toán...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Nhân viên</th>
                  <th className="p-4 text-center">Ngày công</th>
                  <th className="p-4 text-center">Đúng giờ</th>
                  <th className="p-4 text-center">Trễ</th>
                  <th className="p-4 text-right">Giờ chuẩn</th>
                  <th className="p-4 text-right">Lương cơ bản</th>
                  <th className="p-4 text-right">Tổng lương</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!payrollData?.length ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">Không có dữ liệu điểm danh trong tháng này</td></tr>
                ) : payrollData.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {p.avatarUrl ? <img src={p.avatarUrl} alt={p.fullName} className="w-9 h-9 rounded-full object-cover border border-slate-200" /> : <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">{p.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}</div>}
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{p.fullName}</div>
                          <div className="text-xs text-slate-500">{p.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-900">{p.daysWorked}</td>
                    <td className="p-4 text-center"><span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{p.onTime}</span></td>
                    <td className="p-4 text-center"><span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">{p.late}</span></td>
                    <td className="p-4 text-right text-sm text-slate-700">{p.standardHours}h</td>
                    <td className="p-4 text-right text-sm text-slate-700">{fmt(p.baseSalary)}</td>
                    <td className="p-4 text-right font-bold text-blue-700">{fmt(p.totalSalary)}</td>
                  </tr>
                ))}
              </tbody>
              {!!payrollData?.length && user?.role !== 'EMPLOYEE' && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={6} className="p-4 font-bold text-slate-900">Tổng cộng</td>
                    <td className="p-4 text-right font-bold text-blue-700 text-lg">{fmt(totalPayroll)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payroll;
