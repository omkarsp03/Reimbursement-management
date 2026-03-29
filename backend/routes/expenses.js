const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const WorkflowEngine = require('../services/workflowEngine');

const router = express.Router();

// Get all expenses (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const { status, category, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query, params;

    if (req.user.role === 'employee') {
      query = `
        SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               u.first_name || ' ' || u.last_name as submitted_by_name,
               ws.name as current_step_name
        FROM expenses e
        LEFT JOIN categories c ON e.category_id = c.id
        LEFT JOIN users u ON e.submitted_by = u.id
        LEFT JOIN workflow_steps ws ON e.current_step_id = ws.id
        WHERE e.submitted_by = $1
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               u.first_name || ' ' || u.last_name as submitted_by_name,
               ws.name as current_step_name
        FROM expenses e
        LEFT JOIN categories c ON e.category_id = c.id
        LEFT JOIN users u ON e.submitted_by = u.id
        LEFT JOIN workflow_steps ws ON e.current_step_id = ws.id
        WHERE e.company_id = $1
      `;
      params = [req.user.company_id];
    }

    if (status) {
      params.push(status);
      query += ` AND e.status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND c.name = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND e.expense_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND e.expense_date <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (e.title LIKE $${params.length} OR u.first_name LIKE $${params.length} OR u.last_name LIKE $${params.length})`;
    }

    query += ` ORDER BY e.created_at DESC`;

    // Get total count
    const countQuery = query.replace(/SELECT (.*?) FROM/s, 'SELECT COUNT(*) as count FROM').replace(/ORDER BY.*$/, '');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      expenses: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get single expense with full details
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
              u.first_name || ' ' || u.last_name as submitted_by_name, u.email as submitted_by_email,
              u.department as submitted_by_department, u.role as submitted_by_role,
              w.name as workflow_name
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN users u ON e.submitted_by = u.id
       LEFT JOIN workflows w ON e.workflow_id = w.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Get approval trail
    const approvals = await pool.query(
      `SELECT ea.*, u.first_name || ' ' || u.last_name as approver_name, u.role as approver_role,
              ws.name as step_name, ws.step_order
       FROM expense_approvals ea
       JOIN users u ON ea.approver_id = u.id
       LEFT JOIN workflow_steps ws ON ea.step_id = ws.id
       WHERE ea.expense_id = $1
       ORDER BY ws.step_order ASC, ea.created_at ASC`,
      [req.params.id]
    );

    res.json({
      expense: result.rows[0],
      approvals: approvals.rows,
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create expense
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, amount, categoryId, expenseDate, currency } = req.body;

    // Check for duplicates
    const duplicates = await WorkflowEngine.checkDuplicate(
      req.user.company_id, req.user.id, amount, expenseDate
    );

    const result = await pool.query(
      `INSERT INTO expenses (company_id, submitted_by, category_id, title, description, amount, currency, expense_date, is_duplicate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft') RETURNING *`,
      [req.user.company_id, req.user.id, categoryId, title, description, amount, currency || 'INR', expenseDate, duplicates.length > 0]
    );

    res.status(201).json({
      expense: result.rows[0],
      duplicateWarning: duplicates.length > 0,
      possibleDuplicates: duplicates,
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Submit expense (trigger workflow)
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const result = await WorkflowEngine.submitExpense(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Submit expense error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit expense' });
  }
});

// Approve/Reject expense
router.post('/:id/decide', auth, async (req, res) => {
  try {
    const { decision, comments } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    const result = await WorkflowEngine.processApproval(
      parseInt(req.params.id), req.user.id, decision, comments
    );
    res.json(result);
  } catch (error) {
    console.error('Decide expense error:', error);
    res.status(500).json({ error: error.message || 'Failed to process decision' });
  }
});

// Get pending approvals for current user
router.get('/pending/approvals', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
              u.first_name || ' ' || u.last_name as submitted_by_name,
              ea.id as approval_id, ws.name as step_name
       FROM expense_approvals ea
       JOIN expenses e ON ea.expense_id = e.id
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN users u ON e.submitted_by = u.id
       LEFT JOIN workflow_steps ws ON ea.step_id = ws.id
       WHERE ea.approver_id = $1 AND ea.decision = 'pending'
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ approvals: result.rows });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

module.exports = router;
