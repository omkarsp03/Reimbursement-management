const pool = require('../config/db');
const excelLogger = require('./excelLogger');

class WorkflowEngine {
  /**
   * Evaluate all workflow rules against an expense and determine the approval path
   */
  static async evaluateRules(expense, workflowId) {
    const rulesResult = await pool.query(
      'SELECT * FROM workflow_rules WHERE workflow_id = $1 AND is_active = true ORDER BY priority ASC',
      [workflowId]
    );
    const rules = rulesResult.rows;

    const actions = [];

    for (const rule of rules) {
      const matches = await this.evaluateCondition(rule, expense);
      if (matches) {
        actions.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.action_type,
          actionConfig: rule.action_config,
        });
      }
    }

    return actions;
  }

  /**
   * Evaluate a single rule condition against an expense
   */
  static async evaluateCondition(rule, expense) {
    switch (rule.condition_type) {
      case 'amount':
        return this.evaluateAmountCondition(expense.amount, rule.operator, parseFloat(rule.condition_value));
      case 'category':
        return this.evaluateCategoryCondition(expense, rule.operator, rule.condition_value);
      case 'role':
        return this.evaluateRoleCondition(expense, rule.operator, rule.condition_value);
      case 'department':
        return this.evaluateDepartmentCondition(expense, rule.operator, rule.condition_value);
      default:
        return false;
    }
  }

  static evaluateAmountCondition(amount, operator, value) {
    const amt = parseFloat(amount);
    switch (operator) {
      case '>': return amt > value;
      case '<': return amt < value;
      case '>=': return amt >= value;
      case '<=': return amt <= value;
      case '=': return amt === value;
      case '!=': return amt !== value;
      default: return false;
    }
  }

  static async evaluateCategoryCondition(expense, operator, value) {
    let categoryName = expense.category_name;
    if (!categoryName && expense.category_id) {
      const cat = await pool.query('SELECT name FROM categories WHERE id = $1', [expense.category_id]);
      categoryName = cat.rows[0]?.name;
    }
    if (!categoryName) return false;
    switch (operator) {
      case '=': return categoryName.toLowerCase() === value.toLowerCase();
      case '!=': return categoryName.toLowerCase() !== value.toLowerCase();
      case 'in': return value.toLowerCase().split(',').map(v => v.trim()).includes(categoryName.toLowerCase());
      case 'not_in': return !value.toLowerCase().split(',').map(v => v.trim()).includes(categoryName.toLowerCase());
      default: return false;
    }
  }

  static async evaluateRoleCondition(expense, operator, value) {
    let userRole = expense.submitter_role;
    if (!userRole && expense.submitted_by) {
      const user = await pool.query('SELECT role FROM users WHERE id = $1', [expense.submitted_by]);
      userRole = user.rows[0]?.role;
    }
    if (!userRole) return false;
    switch (operator) {
      case '=': return userRole.toLowerCase() === value.toLowerCase();
      case '!=': return userRole.toLowerCase() !== value.toLowerCase();
      case 'in': return value.toLowerCase().split(',').includes(userRole.toLowerCase());
      default: return false;
    }
  }

  static async evaluateDepartmentCondition(expense, operator, value) {
    let dept = expense.department;
    if (!dept && expense.submitted_by) {
      const user = await pool.query('SELECT department FROM users WHERE id = $1', [expense.submitted_by]);
      dept = user.rows[0]?.department;
    }
    if (!dept) return false;
    switch (operator) {
      case '=': return dept.toLowerCase() === value.toLowerCase();
      case '!=': return dept.toLowerCase() !== value.toLowerCase();
      default: return false;
    }
  }

  /**
   * Build the approval path for an expense based on workflow and rules
   */
  static async buildApprovalPath(expense, workflowId) {
    // Get base workflow steps
    const stepsResult = await pool.query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC',
      [workflowId]
    );
    let steps = [...stepsResult.rows];

    // Evaluate rules
    const actions = await this.evaluateRules(expense, workflowId);

    for (const action of actions) {
      switch (action.actionType) {
        case 'auto_approve':
          return { autoApprove: true, steps: [], actions };
        case 'auto_reject':
          return { autoReject: true, steps: [], actions };
        case 'add_step':
          // Check if step already exists
          const exists = steps.some(s => s.approver_role === action.actionConfig.step_role);
          if (!exists) {
            steps.push({
              name: action.actionConfig.step_name,
              approver_role: action.actionConfig.step_role,
              step_order: steps.length + 1,
              step_type: 'sequential',
            });
          }
          break;
        case 'skip_step':
          steps = steps.filter(s => s.approver_role !== action.actionConfig.step_role);
          break;
        case 'set_priority':
          // Mark a step as priority
          steps = steps.map(s => {
            if (s.approver_role === action.actionConfig.step_role) {
              s.is_priority = true;
            }
            return s;
          });
          break;
      }
    }

    // Sort steps by order
    steps.sort((a, b) => a.step_order - b.step_order);

    return { steps, actions, autoApprove: false, autoReject: false };
  }

  /**
   * Process an approval decision and move the expense through the flow
   */
  static async processApproval(expenseId, approverId, decision, comments) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get expense
      const expResult = await client.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
      const expense = expResult.rows[0];
      if (!expense) throw new Error('Expense not found');

      // Get current approval record
      const approvalRes = await client.query(
        `SELECT ea.*, ws.step_order, ws.approver_role, ws.step_type, ws.approval_threshold
         FROM expense_approvals ea
         JOIN workflow_steps ws ON ea.step_id = ws.id
         WHERE ea.expense_id = $1 AND ea.approver_id = $2 AND ea.decision = 'pending'
         LIMIT 1`,
        [expenseId, approverId]
      );

      if (approvalRes.rows.length === 0) {
        throw new Error('No pending approval found for this approver');
      }

      const currentApproval = approvalRes.rows[0];

      // Record the decision
      await client.query(
        `UPDATE expense_approvals SET decision = $1, comments = $2, decided_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [decision, comments, currentApproval.id]
      );

      // Fetch user info for Excel logging
      const userInfo = await client.query(
        `SELECT u.first_name || ' ' || u.last_name as name, u.role
         FROM users u WHERE u.id = $1`,
        [approverId]
      );
      const submitterInfo = await client.query(
        `SELECT u.first_name || ' ' || u.last_name as name
         FROM users u WHERE u.id = $1`,
        [expense.submitted_by]
      );

      // Log to Excel (Approvals/Rejections)
      if (decision === 'approved' || decision === 'rejected') {
        await excelLogger.logDecision({
          expenseId: expense.id,
          expenseTitle: expense.title,
          amount: expense.amount,
          submitterName: submitterInfo.rows[0]?.name || 'Unknown',
          approverName: userInfo.rows[0]?.name || 'Unknown',
          approverRole: userInfo.rows[0]?.role || 'Unknown',
          decision,
          comments,
          timestamp: new Date().toLocaleString()
        });
      }

      // Check for conditional approval rules
      const condResult = await client.query(
        `SELECT * FROM approval_conditions WHERE workflow_id = $1 AND is_active = true`,
        [expense.workflow_id]
      );

      let finalDecision = null;

      // Check priority approver override (CFO instant approval)
      for (const cond of condResult.rows) {
        if (cond.priority_approver_id === approverId && decision === 'approved') {
          finalDecision = 'approved';
          break;
        }
      }

      if (decision === 'rejected') {
        finalDecision = 'rejected';
      }

      if (finalDecision === 'approved') {
        // Instantly approve the expense
        await client.query(
          `UPDATE expenses SET status = 'approved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [expenseId]
        );
        // Mark remaining approvals as skipped
        await client.query(
          `UPDATE expense_approvals SET decision = 'skipped', decided_at = CURRENT_TIMESTAMP
           WHERE expense_id = $1 AND decision = 'pending'`,
          [expenseId]
        );

        // Notify submitter
        await this.createNotification(
          expense.submitted_by,
          'Expense Approved! 🎉',
          `Your expense "${expense.title}" (₹${expense.amount}) has been approved.`,
          'approved',
          'expense',
          expenseId
        );
      } else if (finalDecision === 'rejected') {
        await client.query(
          `UPDATE expenses SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [expenseId]
        );
        await client.query(
          `UPDATE expense_approvals SET decision = 'skipped', decided_at = CURRENT_TIMESTAMP
           WHERE expense_id = $1 AND decision = 'pending' AND id != $2`,
          [expenseId, currentApproval.id]
        );

        await this.createNotification(
          expense.submitted_by,
          'Expense Rejected',
          `Your expense "${expense.title}" (₹${expense.amount}) has been rejected. Reason: ${comments || 'No reason provided'}`,
          'rejected',
          'expense',
          expenseId
        );
      } else if (decision === 'approved') {
        // Check if we should check percentage threshold
        if (currentApproval.step_type === 'parallel') {
          const threshold = parseFloat(currentApproval.approval_threshold) || 100;
          const allApprovals = await client.query(
            `SELECT * FROM expense_approvals WHERE expense_id = $1 AND step_id = $2`,
            [expenseId, currentApproval.step_id]
          );
          const total = allApprovals.rows.length;
          const approved = allApprovals.rows.filter(a => a.decision === 'approved').length;
          const percentage = (approved / total) * 100;

          if (percentage >= threshold) {
            // Move to next step or approve
            await this.moveToNextStep(client, expense, currentApproval);
          }
        } else {
          // Sequential - move to next step
          await this.moveToNextStep(client, expense, currentApproval);
        }
      }

      await client.query('COMMIT');
      return { success: true, decision: finalDecision || decision };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Move expense to the next workflow step
   */
  static async moveToNextStep(client, expense, currentApproval) {
    const nextStep = await client.query(
      `SELECT * FROM workflow_steps WHERE workflow_id = $1 AND step_order > $2 ORDER BY step_order ASC LIMIT 1`,
      [expense.workflow_id, currentApproval.step_order]
    );

    if (nextStep.rows.length === 0) {
      // No more steps - approve the expense
      await client.query(
        `UPDATE expenses SET status = 'approved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [expense.id]
      );
      await this.createNotification(
        expense.submitted_by,
        'Expense Approved! 🎉',
        `Your expense "${expense.title}" (₹${expense.amount}) has been approved.`,
        'approved',
        'expense',
        expense.id
      );
    } else {
      const step = nextStep.rows[0];
      // Update expense current step
      await client.query(
        `UPDATE expenses SET current_step_id = $1, status = 'in_review', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [step.id, expense.id]
      );

      // Find approvers for next step
      const approvers = await client.query(
        `SELECT id FROM users WHERE company_id = $1 AND role = $2 AND is_active = true`,
        [expense.company_id, step.approver_role]
      );

      // Create approval records for next step
      for (const approver of approvers.rows) {
        await client.query(
          `INSERT INTO expense_approvals (expense_id, step_id, approver_id, decision)
           VALUES ($1, $2, $3, 'pending')`,
          [expense.id, step.id, approver.id]
        );

        // Notify next approver
        await this.createNotification(
          approver.id,
          'New Expense Pending Approval',
          `A ₹${expense.amount} expense "${expense.title}" requires your approval.`,
          'approval',
          'expense',
          expense.id
        );
      }
    }
  }

  /**
   * Check for duplicate expenses
   */
  static async checkDuplicate(companyId, submittedBy, amount, expenseDate) {
    const result = await pool.query(
      `SELECT id, title, amount, expense_date FROM expenses
       WHERE company_id = $1 AND submitted_by = $2 AND amount = $3 AND expense_date = $4
       AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 5`,
      [companyId, submittedBy, amount, expenseDate]
    );
    return result.rows;
  }

  /**
   * Create a notification
   */
  static async createNotification(userId, title, message, type, refType, refId) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, title, message, type, refType || null, refId || null]
    );
  }

  /**
   * Submit an expense through the workflow engine
   */
  static async submitExpense(expenseId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expResult = await client.query(
        `SELECT e.*, c.name as category_name, u.role as submitter_role, u.department
         FROM expenses e
         LEFT JOIN categories c ON e.category_id = c.id
         LEFT JOIN users u ON e.submitted_by = u.id
         WHERE e.id = $1`,
        [expenseId]
      );
      const expense = expResult.rows[0];
      if (!expense) throw new Error('Expense not found');

      // Get default workflow if not assigned
      let workflowId = expense.workflow_id;
      if (!workflowId) {
        const wf = await client.query(
          'SELECT id FROM workflows WHERE company_id = $1 AND is_default = true AND is_active = true LIMIT 1',
          [expense.company_id]
        );
        if (wf.rows.length === 0) throw new Error('No active workflow found');
        workflowId = wf.rows[0].id;
      }

      // Build approval path
      const path = await this.buildApprovalPath(expense, workflowId);

      if (path.autoApprove) {
        await client.query(
          `UPDATE expenses SET status = 'approved', workflow_id = $1, submitted_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [workflowId, expenseId]
        );
        await this.createNotification(
          expense.submitted_by,
          'Expense Auto-Approved! 🎉',
          `Your expense "${expense.title}" (₹${expense.amount}) was automatically approved.`,
          'approved', 'expense', expenseId
        );
        await client.query('COMMIT');
        return { status: 'auto_approved', path };
      }

      if (path.autoReject) {
        await client.query(
          `UPDATE expenses SET status = 'rejected', workflow_id = $1, submitted_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [workflowId, expenseId]
        );
        await client.query('COMMIT');
        return { status: 'auto_rejected', path };
      }

      if (path.steps.length === 0) {
        throw new Error('No approval steps configured');
      }

      const firstStep = path.steps[0];
      let firstStepId = firstStep.id;

      // If step doesn't have an ID (dynamically added), create it
      if (!firstStepId) {
        const newStep = await client.query(
          `INSERT INTO workflow_steps (workflow_id, step_order, name, approver_role, step_type)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [workflowId, firstStep.step_order, firstStep.name, firstStep.approver_role, firstStep.step_type]
        );
        firstStepId = newStep.rows[0].id;
      }

      // Update expense status
      await client.query(
        `UPDATE expenses SET status = 'pending', workflow_id = $1, current_step_id = $2, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [workflowId, firstStepId, expenseId]
      );

      // Find approvers for first step
      const approvers = await client.query(
        `SELECT id FROM users WHERE company_id = $1 AND role = $2 AND is_active = true`,
        [expense.company_id, firstStep.approver_role]
      );

      // Create approval records
      for (const approver of approvers.rows) {
        await client.query(
          `INSERT INTO expense_approvals (expense_id, step_id, approver_id, decision)
           VALUES ($1, $2, $3, 'pending')`,
          [expenseId, firstStepId, approver.id]
        );

        await this.createNotification(
          approver.id,
          'New Expense Pending Approval',
          `A ₹${expense.amount} expense "${expense.title}" requires your approval.`,
          'approval', 'expense', expenseId
        );
      }

      await client.query('COMMIT');
      return { status: 'submitted', path };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WorkflowEngine;
