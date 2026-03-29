import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Workflows from './pages/Workflows';
import Users from './pages/Users';

// Add icons to context for easy rendering without massive imports
import { 
  FiHome, FiDollarSign, FiGitMerge, FiUsers, FiSettings, 
  FiLogOut, FiSun, FiMoon, FiBell, FiPlus, FiCheck, FiX, 
  FiSearch, FiFilter, FiMoreVertical, FiChevronRight, FiChevronDown,
  FiUploadCloud, FiFileText, FiClock, FiActivity
} from 'react-icons/fi';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="login-page">
        <div className="loading-spinner"><div className="spinner"></div></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />; // Redirect to dashboard if not authorized
  }
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/expenses" 
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/workflows" 
          element={
            <ProtectedRoute roles={['admin']}>
              <Workflows />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/users" 
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
