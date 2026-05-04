import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, AlertCircle } from 'lucide-react';

const EditEmployeeModal = ({ employee, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({ employeeCode: '', fullName: '', email: '', phone: '', departmentId: '' });
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeCode: employee.employeeCode || '',
        fullName: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        departmentId: employee.departmentId || ''
      });
      setError(null);
      axios.get('http://localhost:5000/api/departments').then(r => setDepartments(r.data)).catch(() => {});
    }
  }, [employee]);

  if (!employee) return null;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeCode || !formData.fullName || !formData.departmentId) {
      setError('Vui lòng điền các trường bắt buộc (*)');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await axios.put(`http://localhost:5000/api/employees/${employee.id}`, formData);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi cập nhật nhân viên');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Chỉnh sửa nhân viên</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mã nhân viên *</label>
              <input type="text" name="employeeCode" value={formData.employeeCode} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                placeholder="VD: NV001" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Họ và tên *</label>
              <input type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                placeholder="VD: Nguyễn Văn A" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                placeholder="VD: a.nguyen@biohr.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số điện thoại</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                placeholder="VD: 0987654321" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phòng ban *</label>
            <select name="departmentId" value={formData.departmentId} onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
              <option value="">Chọn phòng ban...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-sm">Hủy</button>
            <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm text-sm disabled:opacity-60">
              {isLoading ? 'Đang lưu...' : '✓ Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeeModal;
