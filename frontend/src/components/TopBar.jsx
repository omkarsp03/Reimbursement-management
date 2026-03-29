import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiMenu, FiSun, FiMoon, FiBell, FiSearch, FiX } from 'react-icons/fi';
import api from '../services/api';

const TopBar = ({ toggleSidebar, isSidebarOpen }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const notifRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      window.location.href = `/expenses?search=${encodeURIComponent(searchTerm)}`;
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/dashboard/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/dashboard/notifications/${id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/dashboard/notifications/read-all');
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'approval': return '⏳';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="top-bar">
      <button className="btn-icon btn-ghost" onClick={toggleSidebar} style={{ display: window.innerWidth <= 768 ? 'flex' : (isSidebarOpen ? 'none' : 'flex') }}>
        <FiMenu size={20} />
      </button>

      <form onSubmit={handleSearch} className="search-wrapper" style={{ width: '300px', display: window.innerWidth <= 768 ? 'none' : 'block' }}>
        <FiSearch className="search-icon" />
        <input 
          type="text" 
          className="form-input" 
          placeholder="Search expenses..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </form>

      <div className="top-bar-right">
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </button>

        <div className="notification-btn" ref={notifRef}>
          <button 
            className="btn-icon btn-ghost" 
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <FiBell size={20} />
            {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Notifications</h4>
                {unreadCount > 0 && (
                  <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 8px', border: 'none' }} onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                    >
                      <div className={`notification-icon ${notif.type}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notif.title}</div>
                        <div className="notification-message">{notif.message}</div>
                        <div className="notification-time">
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', alignSelf: 'center' }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
