import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutDashboard, Users, Clock, Video, Search, Bell, Settings,
  HelpCircle, LogOut, Fingerprint, CalendarDays, FileText, DollarSign, User, AlertCircle
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const notifRef = useRef(null);
  const settingsRef = useRef(null);

  useEffect(() => {
    if (showNotifMenu) {
      axios.get('http://localhost:5000/api/notifications').then(res => setNotifications(res.data)).catch(console.error);
    }
  }, [showNotifMenu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifMenu(false);
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setShowSettingsMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/employees?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/login');
  };

  const navItems = user?.role === 'EMPLOYEE' ? [
    { name: 'Bảng tin cá nhân', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Điểm danh AI', path: '/ai-config', icon: Video },
    { name: 'Đơn xin nghỉ phép', path: '/leaves', icon: FileText },
    { name: 'Quên chấm công', path: '/exceptions', icon: AlertCircle },
    { name: 'Bảng lương', path: '/payroll', icon: DollarSign },
    { name: 'Hồ sơ cá nhân', path: '/profile', icon: User },
  ] : [
    { name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Nhân viên', path: '/employees', icon: Users },
    { name: 'Điểm danh', path: '/attendance', icon: Clock },
    { name: 'Quản lý ca', path: '/shifts', icon: CalendarDays },
    { name: 'Nghỉ phép', path: '/leaves', icon: FileText },
    { name: 'Quên chấm công', path: '/exceptions', icon: AlertCircle },
    { name: 'Thông báo', path: '/notifications', icon: Bell },
    { name: 'Bảng lương', path: '/payroll', icon: DollarSign },
    { name: 'Cấu hình', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Thanh điều hướng bên trái */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <Fingerprint size={24} />
            </div>
            <div>
              <h1 className="text-blue-700 font-bold text-lg leading-tight tracking-tight">BioHR Systems</h1>
              <p className="text-slate-500 text-[10px] font-semibold tracking-wider uppercase">{user?.role === 'EMPLOYEE' ? 'Portal Nhân viên' : 'Quản trị viên'}</p>
            </div>
          </div>
        </div>

        {/* Điều hướng */}
        <nav className="flex-1 mt-6 px-4">
          <ul className="space-y-1.5">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Thao tác cuối thanh bên */}
        <div className="p-4 border-t border-slate-100">
          {user?.role === 'EMPLOYEE' && (
            <button
              onClick={() => navigate('/ai-config')}
              className="w-full mb-4 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm shadow-blue-200"
            >
              ⚡ Điểm danh Camera
            </button>
          )}
          <ul className="space-y-1">
            <li>
              <a href="#" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                <HelpCircle size={20} />
                <span className="text-sm">Trung tâm hỗ trợ</span>
              </a>
            </li>
            <li>
              <a href="#" onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors">
                <LogOut size={20} />
                <span className="text-sm">Đăng xuất</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* Nội dung chính */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Thanh trên */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="relative w-96">
            {user?.role !== 'EMPLOYEE' && (
              <>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  placeholder="Tìm nhân viên... (Enter để tìm)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow placeholder:text-slate-400"
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
              {showNotifMenu && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-slate-900">Thông báo mới</h3>
                    {user?.role !== 'EMPLOYEE' && <button onClick={() => {setShowNotifMenu(false); navigate('/notifications');}} className="text-xs text-blue-600 font-semibold hover:underline">Quản lý</button>}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">Không có thông báo nào</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <h4 className="text-sm font-bold text-slate-900 mb-1">{n.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                        <p className="text-[10px] text-slate-400 mt-2">{new Date(n.date).toLocaleString('vi-VN')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={settingsRef}>
              <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Settings size={20} />
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 mt-4 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 space-y-1">
                    {user?.role === 'EMPLOYEE' && (
                      <button onClick={() => {setShowSettingsMenu(false); navigate('/profile');}} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                        <User size={16} /> Hồ sơ cá nhân
                      </button>
                    )}
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.fullName || user?.username || 'Admin'}</p>
                <p className="text-xs text-slate-500">{user?.role === 'EMPLOYEE' ? user?.department : (user?.role === 'SUPER_ADMIN' ? 'Quản trị hệ thống' : 'Quản lý HR')}</p>
              </div>
              {user?.role === 'EMPLOYEE' && user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Hồ sơ" className="w-10 h-10 rounded-full border border-slate-200 shadow-sm object-cover" />
              ) : (
                <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Hồ sơ" className="w-10 h-10 rounded-full border border-slate-200 shadow-sm" />
              )}
            </div>
          </div>
        </header>

        {/* Nội dung trang */}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
