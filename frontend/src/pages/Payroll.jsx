import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, ChevronLeft, ChevronRight, DollarSign, Users, Clock, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const Payroll = () => {
  const { user } = useAuthStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`http://localhost:5000/api/payroll?month=${month}&year=${year}`)
      .then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [month, year]);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.role === 'EMPLOYEE' ? 'Lương của tôi' : 'Bảng lương'}</h2>
          <p className="text-slate-500 mt-1">{user?.role === 'EMPLOYEE' ? 'Chi tiết lương thưởng trong tháng của bạn.' : 'Tính toán lương tự động dựa trên dữ liệu điểm danh thực tế.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
            <button onClick={prevMonth} className="text-slate-400 hover:text-slate-700 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-sm font-semibold text-slate-900 w-28 text-center">Tháng {month}/{year}</span>
            <button onClick={nextMonth} className="text-slate-400 hover:text-slate-700 transition-colors"><ChevronRight size={18} /></button>
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Chi tiết — Tháng {month}/{year}</h3>
          <p className="text-xs text-slate-500 mt-1">Đơn giá: 100.000 VNĐ/giờ · Làm thêm giờ: x1.5</p>
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
