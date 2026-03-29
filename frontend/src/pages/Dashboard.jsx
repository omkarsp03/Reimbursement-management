import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiClock, FiCheckCircle, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      // Ensure months are mapped for Recharts if backend returns different format
      const processedTrend = res.data.monthlyTrend?.map(item => ({
        ...item,
        month: item.month || `Month ${item.month_num}`
      })) || [];
      
      setStats({
        ...res.data,
        monthlyTrend: processedTrend
      });
    } catch (err) {
      console.error('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  // Format currency
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: user.baseCurrency || 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'var(--success)';
      case 'rejected': return 'var(--danger)';
      case 'pending': return 'var(--warning)';
      case 'in_review': return 'var(--info)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.firstName} 👋</h1>
          <div className="subtitle">Here's what's happening with your expenses today.</div>
        </div>
        <Link to="/expenses" className="btn btn-primary">Submit Expense</Link>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-header">
            <div className="stat-icon"><FiDollarSign /></div>
            <span className="stat-change positive">+12% this month</span>
          </div>
          <div className="stat-value">{formatMoney(stats?.monthTotal || 0)}</div>
          <div className="stat-label">Total Spend ({new Date().toLocaleString('default', { month: 'long' })})</div>
        </div>

        <div className="stat-card amber">
          <div className="stat-header">
            <div className="stat-icon"><FiClock /></div>
            {stats?.pendingApprovals > 0 && <span className="stat-change negative">{stats.pendingApprovals} to review</span>}
          </div>
          <div className="stat-value">{stats?.pendingApprovals || 0}</div>
          <div className="stat-label">Pending Approvals</div>
        </div>

        <div className="stat-card blue">
          <div className="stat-header">
            <div className="stat-icon"><FiTrendingUp /></div>
            <span className="stat-change positive">-0.5h avg</span>
          </div>
          <div className="stat-value">{stats?.avgApprovalTime || 0}h</div>
          <div className="stat-label">Average Approval Time</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Monthly Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Spend Trend</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [formatMoney(value), 'Total']} 
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Spend by Category</h3>
          </div>
          <div className="chart-container" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '50%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.categoryBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="total"
                  >
                    {stats?.categoryBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '20px' }}>
              {stats?.categoryBreakdown?.slice(0, 5).map((cat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cat.name}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Activity</h3>
          <Link to="/expenses" className="btn btn-ghost btn-sm">View All</Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Expense</th>
                <th>Category</th>
                {user?.role !== 'employee' && <th>Submitter</th>}
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentActivity?.length === 0 ? (
                <tr>
                  <td colSpan={user?.role !== 'employee' ? 6 : 5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>
                    No recent activity
                  </td>
                </tr>
              ) : (
                stats?.recentActivity?.map((exp) => (
                <tr key={exp.id} onClick={() => window.location.href = `/expenses?id=${exp.id}`} style={{ cursor: 'pointer' }}>
                  <td>
                      <div style={{ fontWeight: 600 }}>{exp.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ID: #{exp.id}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                        <span style={{ marginRight: '4px' }}>{exp.category_icon}</span> {exp.category_name}
                      </span>
                    </td>
                    {user?.role !== 'employee' && (
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>{exp.submitted_by_name}</span>
                      </td>
                    )}
                    <td style={{ fontWeight: 600 }}>{formatMoney(exp.amount)}</td>
                    <td>
                      <span className={`badge badge-${exp.status}`}>
                        {exp.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(exp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
