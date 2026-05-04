import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download, Plus, Users, ShieldCheck, AlertTriangle, Fingerprint, Edit2, Eye, MoreVertical, Filter, Trash2, Search, X } from 'lucide-react';
import AddEmployeeModal from '../components/AddEmployeeModal';
import EditEmployeeModal from '../components/EditEmployeeModal';

const ITEMS_PER_PAGE = 8;

const Employees = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [departments, setDepartments] = useState([]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    axios.get('http://localhost:5000/api/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  // Cập nhật search nếu URL thay đổi
  useEffect(() => {
    const s = searchParams.get('search');
    if (s) setSearchText(s);
  }, [searchParams]);

  // ── Lọc client-side ──
  const filtered = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = !searchText || [emp.name, emp.email, emp.employeeCode, emp.dept].some(f => f?.toLowerCase().includes(searchText.toLowerCase()));
      const matchDept = !filterDept || emp.dept === filterDept;
      const matchStatus = !filterStatus || (filterStatus === 'enrolled' ? emp.status === 'Face Enrolled' : emp.status !== 'Face Enrolled');
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, searchText, filterDept, filterStatus]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const enrolledCount = employees.filter(e => e.status === 'Face Enrolled').length;
  const notEnrolledCount = employees.length - enrolledCount;

  // ── Checkbox ──
  const allChecked = paginated.length > 0 && paginated.every(e => selectedIds.includes(e.id));
  const toggleAll = () => setSelectedIds(allChecked ? selectedIds.filter(id => !paginated.find(e => e.id === id)) : [...new Set([...selectedIds, ...paginated.map(e => e.id)])]);
  const toggleOne = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Xóa nhân viên ──
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/employees/${id}`);
      setDeleteConfirm(null);
      setSelectedIds(prev => prev.filter(x => x !== id));
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi xóa nhân viên');
    }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Xóa ${selectedIds.length} nhân viên đã chọn?`)) return;
    for (const id of selectedIds) {
      try { await axios.delete(`http://localhost:5000/api/employees/${id}`); } catch {}
    }
    setSelectedIds([]);
    fetchEmployees();
  };

  // ── Xuất CSV ──
  const exportCSV = () => {
    const header = 'Mã NV,Họ tên,Email,Điện thoại,Phòng ban,Trạng thái AI\n';
    const rows = filtered.map(e => `${e.employeeCode},${e.name},${e.email || ''},${e.phone || ''},${e.dept},${e.status === 'Face Enrolled' ? 'Đã đăng ký' : 'Chưa đăng ký'}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nhan-vien.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải danh sách nhân viên...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tiêu đề */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Danh sách nhân viên</h2>
          <p className="text-slate-500 mt-1">Quản lý dữ liệu sinh trắc học và hồ sơ nhân sự của tổ chức.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Download size={16} /> Xuất Excel
          </button>
          <button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200">
            <Plus size={16} /> Thêm nhân viên mới
          </button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng nhân sự</h3><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={18} /></div></div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{employees.length}</p></div>
          <p className="text-sm text-slate-500">Đang hoạt động</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã đăng ký khuôn mặt</h3><div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><ShieldCheck size={18} /></div></div>
            <p className="text-3xl font-bold text-slate-900 mb-3">{enrolledCount}</p></div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${employees.length ? (enrolledCount / employees.length * 100).toFixed(0) : 0}%` }}></div></div>
          <p className="text-xs text-slate-500 text-right">{employees.length ? (enrolledCount / employees.length * 100).toFixed(0) : 0}%</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thiếu sinh trắc học</h3><div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertTriangle size={18} /></div></div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{notEnrolledCount}</p></div>
          <button onClick={() => setFilterStatus('not_enrolled')} className="text-sm font-semibold text-red-600 hover:text-red-700 underline underline-offset-2 text-left">Xem danh sách</button>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Độ chính xác AI</h3><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Fingerprint size={18} /></div></div>
            <p className="text-3xl font-bold text-slate-900 mb-1">99.8%</p></div>
          <p className="text-sm text-slate-500">Điểm tin cậy trung bình</p>
        </div>
      </div>

      {/* Bảng */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Thanh lọc */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-slate-50/50">
          {/* Tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(1); }}
              placeholder="Tìm tên, email, mã NV..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchText && <button onClick={() => { setSearchText(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
          </div>
          {/* Lọc phòng ban */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none min-w-[160px]">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          {/* Lọc trạng thái */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none min-w-[170px]">
              <option value="">Tất cả trạng thái AI</option>
              <option value="enrolled">Đã đăng ký</option>
              <option value="not_enrolled">Chưa đăng ký</option>
            </select>
          </div>
          {/* Thao tác hàng loạt */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-sm text-slate-500">Đã chọn <b>{selectedIds.length}</b></span>
              <button onClick={handleDeleteSelected} className="flex items-center gap-1 text-red-600 font-medium hover:text-red-700 text-sm border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Xóa đã chọn
              </button>
            </div>
          )}
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></th>
                <th className="p-4">Nhân viên</th>
                <th className="p-4">Phòng ban</th>
                <th className="p-4">Chức vụ</th>
                <th className="p-4">Trạng thái AI</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không tìm thấy nhân viên nào</td></tr>
              ) : paginated.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleOne(emp.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" /> : <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">{emp.initials}</div>}
                      <div><div className="font-semibold text-slate-900">{emp.name}</div><div className="text-sm text-slate-500">{emp.email}</div></div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">{emp.dept}</td>
                  <td className="p-4 text-sm text-slate-700">{emp.role}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${emp.status === 'Face Enrolled' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Face Enrolled' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {emp.status === 'Face Enrolled' ? 'Đã đăng ký khuôn mặt' : 'Chưa đăng ký'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                      <button onClick={() => setEditEmployee(emp)} title="Sửa" className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => navigate(`/employees/${emp.id}`)} title="Xem hồ sơ" className="p-1.5 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors"><Eye size={16} /></button>
                      <button onClick={() => setDeleteConfirm(emp)} title="Xóa" className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
          <div>Hiển thị {Math.min((page - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} / {filtered.length} kết quả</div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">&lt;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
              return <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}>{p}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">&gt;</button>
          </div>
        </div>
      </div>

      {/* Modal thêm */}
      <AddEmployeeModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onAdded={() => { setIsAddOpen(false); fetchEmployees(); }} />

      {/* Modal sửa */}
      <EditEmployeeModal employee={editEmployee} onClose={() => setEditEmployee(null)} onUpdated={() => { setEditEmployee(null); fetchEmployees(); }} />

      {/* Dialog xác nhận xóa */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600"><Trash2 size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-900">Xóa nhân viên</h3>
                <p className="text-sm text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-6">Bạn có chắc muốn xóa <span className="font-semibold">{deleteConfirm.name}</span>? Tất cả dữ liệu điểm danh của nhân viên này cũng sẽ bị xóa.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors">Xóa nhân viên</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
