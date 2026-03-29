const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all workflows for company
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.*, u.first_name || ' ' || u.last_name as created_by_name,
              (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) as step_count,
              (SELECT COUNT(*) FROM workflow_rules WHERE workflow_id = w.id AND is_active = true) as rule_count
       FROM workflows w
       LEFT JOIN users u ON w.created_by = u.id
       WHERE w.company_id = $1
       ORDER BY w.created_at DESC`,
      [req.user.company_id]
    );
    res.json({ workflows: result.rows });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Get single workflow with steps and rules
router.get('/:id', auth, async (req, res) => {
  try {
    const workflow = await pool.query(
      `SELECT w.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM workflows w LEFT JOIN users u ON w.created_by = u.id
       WHERE w.id = $1 AND w.company_id = $2`,
      [req.params.id, req.user.company_id]
    );

    if (workflow.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const steps = await pool.query(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC',
      [req.params.id]
    );

    const rules = await pool.query(
      'SELECT * FROM workflow_rules WHERE workflow_id = $1 ORDER BY priority ASC',
      [req.params.id]
    );

    const conditions = await pool.query(
      `SELECT ac.*, u.first_name || ' ' || u.last_name as priority_approver_name
       FROM approval_conditions ac
       LEFT JOIN users u ON ac.priority_approver_id = u.id
       WHERE ac.workflow_id = $1`,
      [req.params.id]
    );

    res.json({
      workflow: workflow.rows[0],
      steps: steps.rows,
      rules: rules.rows,
      conditions: conditions.rows,
    });
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// Create workflow
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, flowType, isDefault, steps, rules, conditions } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await client.query(
        'UPDATE workflows SET is_default = false WHERE company_id = $1',
        [req.user.company_id]
      );
    }

    const wfResult = await client.query(
      `INSERT INTO workflows (company_id, name, description, flow_type, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.company_id, name, description, flowType || 'sequential', isDefault || false, req.user.id]
    );
    const workflowId = wfResult.rows[0].id;

    // Create steps
    if (steps && steps.length > 0) {
      for (const step of steps) {
        await client.query(
          `INSERT INTO workflow_steps (workflow_id, step_order, name, approver_role, step_type, approval_threshold)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [workflowId, step.order, step.name, step.approverRole, step.stepType || 'sequential', step.approvalThreshold || 100]
        );
      }
    }

    // Create rules
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        await client.query(
          `INSERT INTO workflow_rules (workflow_id, name, description, condition_type, operator, condition_value, action_type, action_config, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [workflowId, rule.name, rule.description, rule.conditionType, rule.operator, rule.conditionValue, rule.actionType, JSON.stringify(rule.actionConfig || {}), rule.priority || 0]
        );
      }
    }

    // Create conditions
    if (conditions && conditions.length > 0) {
      for (const cond of conditions) {
        await client.query(
          `INSERT INTO approval_conditions (workflow_id, condition_type, percentage_threshold, priority_approver_id, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [workflowId, cond.conditionType, cond.percentageThreshold, cond.priorityApproverId, cond.description]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ workflow: wfResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  } finally {
    client.release();
  }
});

// Update workflow
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, flowType, isDefault, isActive, steps, rules, conditions } = req.body;

    if (isDefault) {
      await client.query(
        'UPDATE workflows SET is_default = false WHERE company_id = $1',
        [req.user.company_id]
      );
    }

    await client.query(
      `UPDATE workflows SET name = COALESCE($1, name), description = COALESCE($2, description),
       flow_type = COALESCE($3, flow_type), is_default = COALESCE($4, is_default),
       is_active = COALESCE($5, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND company_id = $7`,
      [name, description, flowType, isDefault, isActive, req.params.id, req.user.company_id]
    );

    // Update steps if provided
    if (steps) {
      await client.query('DELETE FROM workflow_steps WHERE workflow_id = $1', [req.params.id]);
      for (const step of steps) {
        await client.query(
          `INSERT INTO workflow_steps (workflow_id, step_order, name, approver_role, step_type, approval_threshold)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, step.order, step.name, step.approverRole, step.stepType || 'sequential', step.approvalThreshold || 100]
        );
      }
    }

    // Update rules if provided
    if (rules) {
      await client.query('DELETE FROM workflow_rules WHERE workflow_id = $1', [req.params.id]);
      for (const rule of rules) {
        await client.query(
          `INSERT INTO workflow_rules (workflow_id, name, description, condition_type, operator, condition_value, action_type, action_config, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.params.id, rule.name, rule.description, rule.conditionType, rule.operator, rule.conditionValue, rule.actionType, JSON.stringify(rule.actionConfig || {}), rule.priority || 0]
        );
      }
    }

    // Update conditions if provided
    if (conditions) {
      await client.query('DELETE FROM approval_conditions WHERE workflow_id = $1', [req.params.id]);
      for (const cond of conditions) {
        await client.query(
          `INSERT INTO approval_conditions (workflow_id, condition_type, percentage_threshold, priority_approver_id, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, cond.conditionType, cond.percentageThreshold, cond.priorityApproverId, cond.description]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Workflow updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update workflow error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  } finally {
    client.release();
  }
});

// Delete workflow
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM workflows WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

module.exports = router;
