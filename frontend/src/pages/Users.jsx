import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheck, FiX } from 'react-icons/fi';
import api from '../services/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '', password: '', firstName: '', lastName: '', role: 'employee', department: '', managerId: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'employee', department: '', managerId: '' });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      department: user.department || '',
      managerId: user.manager_id || '',
      isActive: user.is_active
    });
    setShowModal(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, formData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', formData);
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user');
    }
  };

  const deleteUser = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('User deactivated');
        fetchUsers();
      } catch (err) {
        toast.error('Failed to deactivate user');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Administration</h1>
          <div className="subtitle">Manage user accounts, roles, and hierarchy.</div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <FiPlus /> Add User
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">User Directory</h3>
          <div className="search-wrapper" style={{ width: '300px' }}>
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ background: u.is_active ? 'var(--accent-gradient)' : 'var(--bg-input)', color: u.is_active ? 'white' : 'var(--text-tertiary)' }}>
                        {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: u.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {u.first_name} {u.last_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{u.department || '-'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{u.manager_name || '-'}</span>
                  </td>
                  <td>
                    {u.is_active ? 
                      <span className="badge badge-approved" style={{ background: 'transparent', border: '1px solid var(--success)' }}>Active</span> : 
                      <span className="badge badge-rejected" style={{ background: 'transparent', border: '1px solid var(--danger)' }}>Inactive</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon btn-ghost" onClick={() => openEditModal(u)} title="Edit user">
                        <FiEdit2 />
                      </button>
                      {u.is_active && (
                        <button className="btn-icon btn-ghost" onClick={() => deleteUser(u.id)} title="Deactivate user">
                          <FiTrash2 style={{ color: 'var(--danger)' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={saveUser}>
              <div className="modal-body">
                {!editingUser && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input type="email" className="form-input" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="employee@company.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Temporary Password</label>
                      <input type="text" className="form-input" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Default@123" />
                      <div className="form-error" style={{ color: 'var(--text-tertiary)' }}>If left blank, "Default@123" is used.</div>
                    </div>
                  </>
                )}
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-input" required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-input" required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Role Definition</label>
                  <select className="form-select" required value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                    <option value="employee">Employee - Can submit expenses</option>
                    <option value="manager">Manager - Level 1 approver</option>
                    <option value="finance">Finance - Validation level approver</option>
                    <option value="director">Director - High tier approver</option>
                    <option value="cfo">CFO - Priority override approver</option>
                    <option value="admin">Sys Admin - Manages users & logic</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input type="text" className="form-input" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} placeholder="e.g. Engineering" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Direct Manager (Optional)</label>
                    <select className="form-select" value={formData.managerId} onChange={(e) => setFormData({...formData, managerId: e.target.value})}>
                      <option value="">None / Unassigned</option>
                      {users.filter(u => u.is_active && u.id !== editingUser?.id).map(u => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingUser && (
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.isActive} 
                        onChange={e => setFormData({...formData, isActive: e.target.checked})}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      Active Account Status
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
