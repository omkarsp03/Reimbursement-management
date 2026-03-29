const express = require('express');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users for company
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.department,
              u.manager_id, u.is_active, u.created_at,
              m.first_name || ' ' || m.last_name as manager_name
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.company_id = $1
       ORDER BY u.created_at DESC`,
      [req.user.company_id]
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin only)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, managerId } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password || 'Default@123', 12);

    const result = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, department, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, first_name, last_name, role, department`,
      [req.user.company_id, email, passwordHash, firstName, lastName, role, department, managerId]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { firstName, lastName, role, department, managerId, isActive } = req.body;

    await pool.query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
       role = COALESCE($3, role), department = COALESCE($4, department),
       manager_id = $5, is_active = COALESCE($6, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND company_id = $8`,
      [firstName, lastName, role, department, managerId, isActive, req.params.id, req.user.company_id]
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

module.exports = router;
