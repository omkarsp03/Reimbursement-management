import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiFilter, FiCheck, FiX, FiFileText, FiClock, FiUploadCloud } from 'react-icons/fi';
import api from '../services/api';

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseApprovals, setExpenseApprovals] = useState([]);
  const [decisionComment, setDecisionComment] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '', description: '', amount: '', categoryId: '', expenseDate: new Date().toISOString().split('T')[0]
  });

  const [activeTab, setActiveTab] = useState('all'); // all, pending, requires_action
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const search = params.get('search');
    
    if (id) {
      openExpenseDetail(id);
    }
    
    if (search) {
      setSearchTerm(search);
    }
    
    // Clean up URL parameters but keep state
    if (id || search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    fetchData();
  }, [activeTab, filterStatus, filterCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/expenses?status=${activeTab === 'pending' ? 'pending' : (filterStatus || '')}`;
      if (filterCategory) url += `&category=${filterCategory}`;
      if (searchTerm) url += `&search=${searchTerm}`;

      const [expRes, catRes] = await Promise.all([
        api.get(url),
        api.get('/dashboard/categories')
      ]);
      setExpenses(expRes.data.expenses);
      setCategories(catRes.data.categories);

      // If manager/admin, fetch pending approvals for them to action
      if (user.role !== 'employee' && activeTab === 'requires_action') {
        const appRes = await api.get('/expenses/pending/approvals');
        setPendingApprovals(appRes.data.approvals);
      }
    } catch (err) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/expenses', formData);
      if (res.data.duplicateWarning) {
        setDuplicateWarning(true);
        // We'll still allow it, but in a real app might block or ask for confirmation
        toast.warning('Warning: Similar expense detected. Saving as draft.');
      } else {
        // Automatically submit for approval if no warning
        await api.post(`/expenses/${res.data.expense.id}/submit`);
        toast.success('Expense submitted for approval!');
      }
      setShowNewExpense(false);
      setFormData({ title: '', description: '', amount: '', categoryId: '', expenseDate: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (err) {
      toast.error('Failed to create expense');
    }
  };

  const openExpenseDetail = async (id) => {
    try {
      const res = await api.get(`/expenses/${id}`);
      setSelectedExpense(res.data.expense);
      setExpenseApprovals(res.data.approvals);
      setShowExpenseDetail(true);
      setDecisionComment('');
    } catch (err) {
      toast.error('Failed to fetch expense details');
    }
  };

  const handleDecision = async (expenseId, decision) => {
    try {
      await api.post(`/expenses/${expenseId}/decide`, {
        decision,
        comments: decisionComment
      });
      toast.success(`Expense ${decision} successfully`);
      setShowExpenseDetail(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${decision} expense`);
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: user.baseCurrency || 'INR', maximumFractionDigits: 0
    }).format(amount);
  };

  const renderExpenseList = () => {
    const list = activeTab === 'requires_action' ? pendingApprovals : expenses;
    
    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
    
    if (list.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No expenses found</h3>
          <p>There are no expenses matching your current view.</p>
        </div>
      );
    }

    return (
      <div className="expense-list animate-in">
        {list.map(exp => (
          <div key={exp.id || exp.approval_id} className="expense-card" onClick={() => openExpenseDetail(exp.id)}>
            <div className="expense-icon" style={{ background: exp.category_color ? `${exp.category_color}20` : 'var(--bg-input)' }}>
              {exp.category_icon || '📋'}
            </div>
            
            <div className="expense-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="expense-title">{exp.title}</div>
                <div className="expense-amount">
                  {formatMoney(exp.amount)}
                </div>
              </div>
              
              <div className="expense-meta" style={{ marginTop: '8px' }}>
                <span className={`badge badge-${exp.status}`}>{exp.status.replace('_', ' ')}</span>
                
                {activeTab === 'requires_action' && (
                  <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiClock /> Requires your action: {exp.step_name}
                  </span>
                )}
                
                {(activeTab === 'all' || activeTab === 'pending') && exp.status === 'pending' && (
                  <span>Current Step: {exp.current_step_name || 'Pending Approval'}</span>
                )}
                
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(exp.expense_date).toLocaleDateString()}
                  {user.role !== 'employee' && ` • ${exp.submitted_by_name}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <div className="subtitle">Manage and track all reimbursement requests.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewExpense(true)}>
          <FiPlus /> New Expense
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Expenses</button>
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>Pending Output</button>
        {user.role !== 'employee' && (
          <button className={`tab ${activeTab === 'requires_action' ? 'active' : ''}`} onClick={() => setActiveTab('requires_action')}>
            Requires Action
            {pendingApprovals.length > 0 && <span style={{ marginLeft: '6px', background: 'var(--danger)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendingApprovals.length}</span>}
          </button>
        )}
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div className="search-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search by title or submitter..." 
            style={{ paddingLeft: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          />
        </div>
        <button 
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter /> Filter
        </button>
      </div>

      {showFilters && (
        <div className="card animate-in" style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-tertiary)' }}>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Status</label>
              <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="in_review">In Review</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Category</label>
              <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => {
                setFilterStatus('');
                setFilterCategory('');
                setSearchTerm('');
                fetchData();
              }}>Reset Filters</button>
            </div>
          </div>
        </div>
      )}

      {renderExpenseList()}

      {/* New Expense Modal */}
      {showNewExpense && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewExpense(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>New Expense Request</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowNewExpense(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Expense Title</label>
                  <input type="text" className="form-input" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Flight to Mumbai" />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <input type="number" step="0.01" className="form-input" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" required value={formData.expenseDate} onChange={(e) => setFormData({...formData, expenseDate: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" required value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}>
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea className="form-textarea" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Provide additional details..." />
                </div>

                <div className="form-group">
                  <label className="form-label">Receipt</label>
                  <div style={{ border: '2px dashed var(--border-primary)', padding: '30px', textAlign: 'center', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                    <FiUploadCloud size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }} />
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Click to upload or drag and drop receipt</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>JPG, PNG or PDF (max 5MB)</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewExpense(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Details & Approval Modal */}
      {showExpenseDetail && selectedExpense && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowExpenseDetail(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2><FiFileText /> Expense Details - #{selectedExpense.id}</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowExpenseDetail(false)}><FiX /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* Left Column: Details */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{selectedExpense.title}</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span className={`badge badge-${selectedExpense.status}`}>{selectedExpense.status.replace('_', ' ')}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {selectedExpense.category_icon} {selectedExpense.category_name}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(selectedExpense.expense_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {formatMoney(selectedExpense.amount)}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Submitted By</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar">{selectedExpense.submitted_by_name?.charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{selectedExpense.submitted_by_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedExpense.submitted_by_email} • {selectedExpense.submitted_by_department}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Description</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {selectedExpense.description || 'No description provided.'}
                  </p>
                </div>
                
                {selectedExpense.is_duplicate && (
                  <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <FiAlertCircle style={{ color: 'var(--warning)', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: '0.85rem' }}>Duplicate Warning</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>This expense matches another recent submission in amount and date. Please review carefully.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Approval Trail & Actions */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                <h4 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>Audit Trail</h4>
                
                <div className="approval-trail">
                  {/* Origin */}
                  <div className="trail-item" style={{ '::before': { background: 'var(--text-secondary)', borderColor: 'var(--text-secondary)' } }}>
                    <div className="trail-name">Expense Submitted</div>
                    <div className="trail-role">{selectedExpense.submitted_by_name}</div>
                    <div className="trail-time">{new Date(selectedExpense.submitted_at || selectedExpense.created_at).toLocaleString()}</div>
                  </div>

                  {/* Flow */}
                  {expenseApprovals.map((app, i) => (
                    <div key={i} className={`trail-item ${app.decision}`}>
                      <div className="trail-name">{app.approver_name}</div>
                      <div className="trail-role">{app.step_name} ({app.approver_role})</div>
                      {app.decision !== 'pending' && <div className="trail-time">{new Date(app.decided_at).toLocaleString()}</div>}
                      {app.comments && <div className="trail-comment">"{app.comments}"</div>}
                      
                      {app.decision === 'pending' && <div className="badge badge-pending" style={{ marginTop: '4px' }}>Pending</div>}
                      {app.decision === 'approved' && <div className="badge badge-approved" style={{ marginTop: '4px' }}>Approved</div>}
                      {app.decision === 'rejected' && <div className="badge badge-rejected" style={{ marginTop: '4px' }}>Rejected</div>}
                      {app.decision === 'skipped' && <div className="badge" style={{ marginTop: '4px', background: 'var(--bg-input)' }}>Skipped</div>}
                    </div>
                  ))}
                </div>

                {/* Manager Action Area */}
                {activeTab === 'requires_action' && selectedExpense.status !== 'approved' && selectedExpense.status !== 'rejected' && (
                  <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-primary)', paddingTop: '20px' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Your Decision</h4>
                    <textarea 
                      className="form-textarea" 
                      style={{ minHeight: '80px', marginBottom: '16px', background: 'var(--bg-elevated)' }}
                      placeholder="Add comments (optional)..."
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <button className="btn btn-danger" onClick={() => handleDecision(selectedExpense.id, 'rejected')}>
                        <FiX /> Reject
                      </button>
                      <button className="btn btn-success" onClick={() => handleDecision(selectedExpense.id, 'approved')}>
                        <FiCheck /> Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
