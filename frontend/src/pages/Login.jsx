import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Demo@123');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">EF</div>
          <h1>ExpenseFlow</h1>
          <div className="login-subtitle">Smart Approval Workflow Engine</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="search-wrapper">
              <FiMail className="search-icon" />
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label">Password</label>
              <a href="#" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Forgot?</a>
            </div>
            <div className="search-wrapper">
              <FiLock className="search-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in securely'}
            {!loading && <FiArrowRight />}
          </button>
        </form>

        <div className="login-divider">Demo Accounts</div>

        <div className="demo-accounts">
          <div className="demo-account" onClick={() => fillDemoAccount('employee1@techcorp.com')}>
            <span className="email">employee1@techcorp.com</span>
            <span className="role employee">Employee</span>
          </div>
          <div className="demo-account" onClick={() => fillDemoAccount('manager@techcorp.com')}>
            <span className="email">manager@techcorp.com</span>
            <span className="role manager">Manager</span>
          </div>
          <div className="demo-account" onClick={() => fillDemoAccount('finance@techcorp.com')}>
            <span className="email">finance@techcorp.com</span>
            <span className="role finance">Finance</span>
          </div>
          <div className="demo-account" onClick={() => fillDemoAccount('director@techcorp.com')}>
            <span className="email">director@techcorp.com</span>
            <span className="role director">Director</span>
          </div>
          <div className="demo-account" onClick={() => fillDemoAccount('cfo@techcorp.com')}>
            <span className="email">cfo@techcorp.com</span>
            <span className="role cfo">CFO</span>
          </div>
          <div className="demo-account" onClick={() => fillDemoAccount('admin@techcorp.com')} style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '10px', marginTop: '4px' }}>
            <span className="email">admin@techcorp.com</span>
            <span className="role admin">Sys Admin</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
