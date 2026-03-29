const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isEmployee = req.user.role === 'employee';

    // Total expenses this month
    const monthExpenses = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses
       WHERE company_id = $1 ${isEmployee ? 'AND submitted_by = $2' : ''}
       AND strftime('%m', expense_date) = strftime('%m', 'now')
       AND strftime('%Y', expense_date) = strftime('%Y', 'now')`,
      isEmployee ? [companyId, userId] : [companyId]
    );

    // Pending approvals
    const pendingApprovals = await pool.query(
      `SELECT COUNT(*) as count FROM expense_approvals ea
       JOIN expenses e ON ea.expense_id = e.id
       WHERE ea.approver_id = $1 AND ea.decision = 'pending'`,
      [userId]
    );

    // Status breakdown
    const statusBreakdown = await pool.query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE company_id = $1 ${isEmployee ? 'AND submitted_by = $2' : ''}
       GROUP BY status`,
      isEmployee ? [companyId, userId] : [companyId]
    );

    // Category breakdown
    const categoryBreakdown = await pool.query(
      `SELECT c.name, c.icon, c.color, COUNT(e.id) as count, COALESCE(SUM(e.amount), 0) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.company_id = $1 ${isEmployee ? 'AND e.submitted_by = $2' : ''}
       AND strftime('%m', e.expense_date) = strftime('%m', 'now')
       GROUP BY c.name, c.icon, c.color
       ORDER BY total DESC`,
      isEmployee ? [companyId, userId] : [companyId]
    );

    // Monthly trend (last 6 months)
    const monthlyTrend = await pool.query(
      `SELECT strftime('%m', expense_date) as month_num,
              strftime('%b', expense_date) as month,
              COALESCE(SUM(amount), 0) as total,
              COUNT(*) as count
       FROM expenses
       WHERE company_id = $1 ${isEmployee ? 'AND submitted_by = $2' : ''}
       AND expense_date >= date('now', '-6 months')
       GROUP BY strftime('%m', expense_date)
       ORDER BY month_num ASC`,
      isEmployee ? [companyId, userId] : [companyId]
    );

    // Average approval time
    const avgApprovalTime = await pool.query(
      `SELECT AVG((julianday(resolved_at) - julianday(submitted_at)) * 24) as avg_hours
       FROM expenses
       WHERE company_id = $1 AND resolved_at IS NOT NULL AND submitted_at IS NOT NULL`,
      [companyId]
    );

    // Recent activity
    const recentActivity = await pool.query(
      `SELECT e.id, e.title, e.amount, e.status, e.created_at,
              u.first_name || ' ' || u.last_name as submitted_by_name,
              c.name as category_name, c.icon as category_icon
       FROM expenses e
       LEFT JOIN users u ON e.submitted_by = u.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.company_id = $1
       ORDER BY e.created_at DESC LIMIT 5`,
      [companyId]
    );

    // Top spenders (admin/manager view)
    let topSpenders = [];
    if (!isEmployee) {
      const spenders = await pool.query(
        `SELECT u.first_name || ' ' || u.last_name as name, u.department,
                COUNT(e.id) as expense_count, COALESCE(SUM(e.amount), 0) as total
         FROM expenses e
         JOIN users u ON e.submitted_by = u.id
         WHERE e.company_id = $1
         AND strftime('%m', e.expense_date) = strftime('%m', 'now')
         GROUP BY u.first_name, u.last_name, u.department
         ORDER BY total DESC LIMIT 5`,
        [companyId]
      );
      topSpenders = spenders.rows;
    }

    res.json({
      monthTotal: parseFloat(monthExpenses.rows[0].total),
      monthCount: parseInt(monthExpenses.rows[0].count),
      pendingApprovals: parseInt(pendingApprovals.rows[0].count),
      statusBreakdown: statusBreakdown.rows,
      categoryBreakdown: categoryBreakdown.rows,
      monthlyTrend: monthlyTrend.rows,
      avgApprovalTime: parseFloat(avgApprovalTime.rows[0].avg_hours || 0).toFixed(1),
      recentActivity: recentActivity.rows,
      topSpenders,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get categories
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE company_id = $1 AND is_active = true ORDER BY name ASC',
      [req.user.company_id]
    );
    res.json({ categories: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    const unreadCount = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
