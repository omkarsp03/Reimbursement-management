import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiSettings, FiTrash2, FiEdit2, FiCheck, FiX, FiSave, FiGitMerge, FiMoreVertical } from 'react-icons/fi';
import api from '../services/api';

const Workflows = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Builder state
  const [isBuilding, setIsBuilding] = useState(false);
  const [workflow, setWorkflow] = useState({
    name: 'New Custom Workflow',
    description: '',
    flowType: 'sequential',
    isDefault: false,
    isActive: true,
    steps: [],
    rules: [],
    conditions: []
  });

  const [draggedStepIdx, setDraggedStepIdx] = useState(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      setWorkflows(res.data.workflows);
    } catch (err) {
      toast.error('Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedStepIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      // Add a tiny delay so the ghost element renders before we hide the original
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedStepIdx === null || draggedStepIdx === index) return;

    // Create a new array and swap elements
    const newSteps = [...workflow.steps];
    const draggedStep = newSteps[draggedStepIdx];
    
    // Remove the dragged item from its original position
    newSteps.splice(draggedStepIdx, 1);
    // Insert it into the new position
    newSteps.splice(index, 0, draggedStep);
    
    // Update order values
    const updatedSteps = newSteps.map((step, idx) => ({
      ...step,
      order: idx + 1
    }));
    
    setDraggedStepIdx(index);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const handleDragEnd = (e) => {
    setDraggedStepIdx(null);
    e.target.style.opacity = '1';
  };

  const addStep = (role, name) => {
    const newStep = {
      order: workflow.steps.length + 1,
      name: name || `${role.charAt(0).toUpperCase() + role.slice(1)} Approval`,
      approverRole: role,
      stepType: 'sequential',
      approvalThreshold: 100
    };
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
  };

  const removeStep = (index) => {
    const newSteps = [...workflow.steps];
    newSteps.splice(index, 1);
    
    // Update orders
    const updatedSteps = newSteps.map((step, idx) => ({
      ...step,
      order: idx + 1
    }));
    
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const addRule = () => {
    const newRule = {
      name: 'New Rule',
      description: '',
      conditionType: 'amount',
      operator: '>',
      conditionValue: '10000',
      actionType: 'add_step',
      actionConfig: { step_role: 'director', step_name: 'Director Approval' },
      priority: workflow.rules.length
    };
    setWorkflow({ ...workflow, rules: [...workflow.rules, newRule] });
  };

  const removeRule = (index) => {
    const newRules = [...workflow.rules];
    newRules.splice(index, 1);
    setWorkflow({ ...workflow, rules: newRules });
  };

  const updateRule = (index, field, value) => {
    const newRules = [...workflow.rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setWorkflow({ ...workflow, rules: newRules });
  };

  const updateRuleConfig = (index, field, value) => {
    const newRules = [...workflow.rules];
    newRules[index] = { 
      ...newRules[index], 
      actionConfig: { ...newRules[index].actionConfig, [field]: value } 
    };
    setWorkflow({ ...workflow, rules: newRules });
  };

  const saveWorkflow = async () => {
    try {
      if (workflow.id) {
        await api.put(`/workflows/${workflow.id}`, workflow);
        toast.success('Workflow updated');
      } else {
        await api.post('/workflows', workflow);
        toast.success('Workflow created successfully');
      }
      setIsBuilding(false);
      fetchWorkflows();
    } catch (err) {
      toast.error('Failed to save workflow');
    }
  };

  const openBuilder = async (wf = null) => {
    if (wf) {
      try {
        const res = await api.get(`/workflows/${wf.id}`);
        const fullWf = res.data;
        setWorkflow({
          id: fullWf.workflow.id,
          name: fullWf.workflow.name,
          description: fullWf.workflow.description || '',
          flowType: fullWf.workflow.flow_type || 'sequential',
          isDefault: fullWf.workflow.is_default,
          isActive: fullWf.workflow.is_active,
          steps: fullWf.steps.map(s => ({
            id: s.id,
            order: s.step_order,
            name: s.name,
            approverRole: s.approver_role,
            stepType: s.step_type,
            approvalThreshold: s.approval_threshold
          })),
          rules: fullWf.rules.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description || '',
            conditionType: r.condition_type,
            operator: r.operator,
            conditionValue: r.condition_value,
            actionType: r.action_type,
            actionConfig: typeof r.action_config === 'string' ? JSON.parse(r.action_config) : r.action_config,
            priority: r.priority
          })),
          conditions: fullWf.conditions.map(c => ({
            id: c.id,
            conditionType: c.condition_type,
            percentageThreshold: c.percentage_threshold,
            priorityApproverId: c.priority_approver_id,
            description: c.description || ''
          }))
        });
      } catch (err) {
        toast.error('Failed to load workflow details');
        return;
      }
    } else {
      setWorkflow({
        name: 'New Custom Workflow',
        description: '',
        flowType: 'sequential',
        isDefault: false,
        isActive: true,
        steps: [],
        rules: [],
        conditions: []
      });
    }
    setIsBuilding(true);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="animate-in">
      {!isBuilding ? (
        <>
          <div className="page-header">
            <div>
              <h1>Workflows</h1>
              <div className="subtitle">Configure automated multi-step routing and approval rules.</div>
            </div>
            <button className="btn btn-primary" onClick={() => openBuilder()}>
              <FiPlus /> Create Workflow
            </button>
          </div>

          <div className="stats-grid">
            {workflows.map(wf => (
              <div key={wf.id} className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', border: wf.is_default ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)' }}>
                <div style={{ padding: '24px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiGitMerge size={20} style={{ color: 'var(--accent-primary)' }} />
                      <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{wf.name}</h3>
                    </div>
                    {wf.is_default && <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>Default</span>}
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', minHeight: '40px' }}>
                    {wf.description || 'No description provided.'}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary-bg)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {wf.step_count}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Steps</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--warning-bg)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {wf.rule_count}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rules</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '12px 24px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-primary)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>By {wf.created_by_name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => openBuilder(wf)} style={{ padding: '4px 12px' }}>
                    <FiSettings style={{ marginRight: '6px' }} /> Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Workflow Builder View */
        <div className="builder-header animate-slide-in">
          <div className="page-header" style={{ marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <button className="btn-icon btn-ghost" onClick={() => setIsBuilding(false)}>
                  <FiX />
                </button>
                <input 
                  type="text" 
                  value={workflow.name} 
                  onChange={e => setWorkflow({...workflow, name: e.target.value})}
                  style={{ fontSize: '1.5rem', fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '2px dashed var(--border-primary)', color: 'var(--text-primary)', padding: '4px 0', minWidth: '300px' }}
                />
              </div>
              <input 
                type="text" 
                value={workflow.description} 
                onChange={e => setWorkflow({...workflow, description: e.target.value})}
                placeholder="Workflow description..."
                style={{ fontSize: '0.9rem', width: '100%', maxWidth: '600px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', marginLeft: '48px', padding: '4px 0' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={workflow.isDefault} 
                  onChange={e => setWorkflow({...workflow, isDefault: e.target.checked})}
                  style={{ transform: 'scale(1.2)' }}
                />
                Default Workflow
              </label>
              <button className="btn btn-secondary" onClick={() => setIsBuilding(false)}>Cancel</button>
              <button className="btn btn-success" onClick={saveWorkflow}><FiSave /> Save Config</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '32px' }}>
            {/* Step Builder (Left) */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: '24px' }}>
                <h3 className="card-title">Base Approval Path</h3>
              </div>
              
              <div className="workflow-steps">
                {workflow.steps.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Add roles to create the baseline sequential approval flow.</p>
                  </div>
                ) : (
                  workflow.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`workflow-step ${draggedStepIdx === index ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="step-number">{step.order}</div>
                      <div className="step-content">
                        <div className="step-name">{step.name}</div>
                        <div className="step-role">{step.approverRole}</div>
                      </div>
                      <div className="step-actions">
                        <FiMoreVertical style={{ color: 'var(--text-tertiary)', cursor: 'grab' }} />
                        <button className="btn-icon btn-ghost" onClick={() => removeStep(index)}>
                          <FiTrash2 style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-primary)', paddingTop: '24px' }}>
                <label className="form-label">Add Step</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['manager', 'finance', 'director', 'cfo', 'admin'].map(role => (
                    <button key={role} className="btn btn-secondary btn-sm" onClick={() => addStep(role)} style={{ textTransform: 'capitalize' }}>
                      + {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rule Builder (Right) */}
            <div className="card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent-primary)', opacity: 0.98 }}>
              <div className="card-header" style={{ marginBottom: '24px' }}>
                <div>
                  <h3 className="card-title" style={{ color: 'var(--accent-primary)' }}>Rule-Based Logic Engine ⚡</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Define conditions to alter the base path based on expense properties.</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={addRule}>
                  <FiPlus /> Add Rule
                </button>
              </div>

              {workflow.rules.length === 0 ? (
                <div className="empty-state" style={{ padding: '64px 32px' }}>
                  <div className="empty-icon">🧠</div>
                  <h3>No smart rules defined</h3>
                  <p>Add rules like "If Amount &gt; ₹10,000, add Director Approval" to make your workflow dynamic.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {workflow.rules.map((rule, idx) => (
                    <div key={idx} className={`rule-card ${rule.conditionType}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <input 
                          type="text" 
                          value={rule.name}
                          onChange={e => updateRule(idx, 'name', e.target.value)}
                          className="form-input"
                          style={{ background: 'transparent', padding: '0', border: 'none', fontSize: '1rem', fontWeight: 600, width: '70%' }}
                        />
                        <button className="btn-icon btn-ghost" onClick={() => removeRule(idx)}>
                          <FiTrash2 style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                      
                      {/* Condition Builder (IF) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.2rem' }}>IF</span>
                        
                        <select className="form-select" style={{ width: '180px', padding: '6px 12px' }} value={rule.conditionType} onChange={e => updateRule(idx, 'conditionType', e.target.value)}>
                          <option value="amount">Amount</option>
                          <option value="category">Category</option>
                          <option value="role">Submitter Role</option>
                          <option value="department">Department</option>
                        </select>
                        
                        <select className="form-select" style={{ width: '120px', padding: '6px 12px' }} value={rule.operator} onChange={e => updateRule(idx, 'operator', e.target.value)}>
                          <option value="=">Equals (=)</option>
                          <option value="!=">Not Equals (!=)</option>
                          {rule.conditionType === 'amount' && (
                            <>
                              <option value=">">Greater than (&gt;)</option>
                              <option value="<">Less than (&lt;)</option>
                            </>
                          )}
                          <option value="in">In List</option>
                        </select>
                        
                        <input 
                          type={rule.conditionType === 'amount' ? 'number' : 'text'}
                          className="form-input"
                          style={{ flex: 1, padding: '6px 12px' }}
                          value={rule.conditionValue}
                          onChange={e => updateRule(idx, 'conditionValue', e.target.value)}
                          placeholder="Value..."
                        />
                      </div>

                      {/* Action Builder (THEN) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--accent-primary-bg)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-focus)' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.2rem' }}>THEN</span>
                        
                        <select className="form-select" style={{ width: '220px', padding: '6px 12px', background: 'var(--bg-elevated)' }} value={rule.actionType} onChange={e => updateRule(idx, 'actionType', e.target.value)}>
                          <option value="add_step">Add Approval Step</option>
                          <option value="skip_step">Skip Approval Step</option>
                          <option value="auto_approve">Auto-Approve Expense</option>
                          <option value="auto_reject">Auto-Reject Expense</option>
                        </select>

                        {(rule.actionType === 'add_step' || rule.actionType === 'skip_step') && (
                          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                            <select className="form-select" style={{ width: '150px', padding: '6px 12px', background: 'var(--bg-elevated)' }} value={rule.actionConfig.step_role || ''} onChange={e => updateRuleConfig(idx, 'step_role', e.target.value)}>
                              <option value="">Select Role</option>
                              <option value="manager">Manager</option>
                              <option value="finance">Finance</option>
                              <option value="director">Director</option>
                              <option value="cfo">CFO</option>
                            </select>
                            
                            {rule.actionType === 'add_step' && (
                              <input 
                                type="text"
                                className="form-input"
                                style={{ flex: 1, padding: '6px 12px', background: 'var(--bg-elevated)' }}
                                value={rule.actionConfig.step_name || ''}
                                onChange={e => updateRuleConfig(idx, 'step_name', e.target.value)}
                                placeholder="Step Name (e.g., Final CEO Review)"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflows;
