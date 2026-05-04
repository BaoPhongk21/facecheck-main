import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import Attendance from './pages/Attendance';
import Login from './pages/Login';
import AIConfig from './pages/AIConfig';
import Payroll from './pages/Payroll';
import Shifts from './pages/Shifts';
import Leaves from './pages/Leaves';
import Notifications from './pages/Notifications';
import useAuthStore from './store/useAuthStore';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeProfileConfig from './pages/EmployeeProfileConfig';
import Settings from './pages/Settings';
import Exceptions from './pages/Exceptions';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<EmployeeProfileConfig />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeProfile />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="ai-config" element={<AIConfig />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="exceptions" element={<Exceptions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
