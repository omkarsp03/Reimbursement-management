import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiHome, FiDollarSign, FiGitMerge, FiUsers, 
  FiSettings, FiLogOut 
} from 'react-icons/fi';

const Sidebar = ({ isOpen, toggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!isOpen && window.innerWidth <= 768) return null;

  return (
    <aside className="sidebar" style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
      <div className="sidebar-logo">
        <div className="logo-icon">EF</div>
        <div className="logo-text">ExpenseFlow</div>
        <span className="logo-badge">PRO</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiHome className="nav-icon" />
            Dashboard
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          <NavLink to="/expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiDollarSign className="nav-icon" />
            Expenses
          </NavLink>
        </div>

        {user?.role === 'admin' && (
          <div className="nav-section">
            <div className="nav-section-title">Administration</div>
            <NavLink to="/workflows" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiGitMerge className="nav-icon" />
              Workflows
            </NavLink>
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiUsers className="nav-icon" />
              Users & Roles
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={logout}>
          <div className="user-avatar">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.firstName} {user?.lastName}</div>
            <div className="user-role">{user?.role} • {user?.companyName}</div>
          </div>
          <FiLogOut className="nav-icon" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
