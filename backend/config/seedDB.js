const pool = require('./db');
const bcrypt = require('bcryptjs');

const seedDB = async () => {
  const client = await pool.connect();
  try {
    // Check if data already exists
    const existing = await client.query('SELECT COUNT(*) as count FROM companies');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('⚠️  Database already seeded, skipping...');
      return;
    }

    // Create demo company
    const companyRes = await client.query(`
      INSERT INTO companies (name, domain, base_currency)
      VALUES ('TechCorp Solutions', 'techcorp.com', 'INR')
    `);
    // SQLite wrapper returns lastID in rows[0].id
    const companyId = companyRes.rows[0].id;

    // Create categories
    const categoriesData = [
      { name: 'Travel', icon: '✈️', color: '#6366f1' },
      { name: 'Food & Dining', icon: '🍔', color: '#f59e0b' },
      { name: 'Office Supplies', icon: '📎', color: '#10b981' },
      { name: 'Software', icon: '💻', color: '#8b5cf6' },
      { name: 'Client Entertainment', icon: '🎭', color: '#ec4899' },
      { name: 'Training', icon: '📚', color: '#14b8a6' },
      { name: 'Equipment', icon: '🔧', color: '#f97316' },
      { name: 'Miscellaneous', icon: '📋', color: '#64748b' },
    ];

    const categoryIds = {};
    for (const cat of categoriesData) {
      const res = await client.query(
        'INSERT INTO categories (company_id, name, icon, color) VALUES ($1, $2, $3, $4)',
        [companyId, cat.name, cat.icon, cat.color]
      );
      categoryIds[cat.name] = res.rows[0].id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('Demo@123', 12);

    // Create users
    const usersData = [
      { email: 'admin@techcorp.com', first_name: 'Rajesh', last_name: 'Kumar', role: 'admin', department: 'Management' },
      { email: 'cfo@techcorp.com', first_name: 'Priya', last_name: 'Sharma', role: 'cfo', department: 'Finance' },
      { email: 'director@techcorp.com', first_name: 'Vikram', last_name: 'Singh', role: 'director', department: 'Operations' },
      { email: 'finance@techcorp.com', first_name: 'Anita', last_name: 'Desai', role: 'finance', department: 'Finance' },
      { email: 'manager@techcorp.com', first_name: 'Suresh', last_name: 'Patel', role: 'manager', department: 'Engineering' },
      { email: 'employee1@techcorp.com', first_name: 'Amit', last_name: 'Verma', role: 'employee', department: 'Engineering' },
      { email: 'employee2@techcorp.com', first_name: 'Neha', last_name: 'Gupta', role: 'employee', department: 'Marketing' },
    ];

    const userIds = {};
    for (const user of usersData) {
      const res = await client.query(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [companyId, user.email, passwordHash, user.first_name, user.last_name, user.role, user.department]
      );
      userIds[user.role + (user.email.includes('1') ? '1' : user.email.includes('2') ? '2' : '')] = res.rows[0].id;
    }

    // Set manager relationships
    await client.query('UPDATE users SET manager_id = $1 WHERE email = $2', [userIds.manager, 'employee1@techcorp.com']);
    await client.query('UPDATE users SET manager_id = $1 WHERE email = $2', [userIds.manager, 'employee2@techcorp.com']);
    await client.query('UPDATE users SET manager_id = $1 WHERE email = $2', [userIds.director, 'manager@techcorp.com']);

    // Create default workflow: Standard Approval
    const wfRes = await client.query(
      `INSERT INTO workflows (company_id, name, description, is_active, is_default, flow_type, created_by)
       VALUES ($1, 'Standard Approval', 'Default multi-step approval workflow for all expenses', true, true, 'sequential', $2)`,
      [companyId, userIds.admin]
    );
    const workflowId = wfRes.rows[0].id;

    // Create workflow steps
    const stepsData = [
      { order: 1, name: 'Manager Approval', role: 'manager', type: 'sequential' },
      { order: 2, name: 'Finance Review', role: 'finance', type: 'sequential' },
      { order: 3, name: 'Director Approval', role: 'director', type: 'sequential' },
    ];

    const stepIds = {};
    for (const step of stepsData) {
      const res = await client.query(
        `INSERT INTO workflow_steps (workflow_id, step_order, name, approver_role, step_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [workflowId, step.order, step.name, step.role, step.type]
      );
      stepIds[step.role] = res.rows[0].id;
    }

    // Create workflow rules
    const rulesData = [
      {
        name: 'High Amount → Director Required',
        description: 'If expense amount > ₹10,000, add Director approval',
        condition_type: 'amount',
        operator: '>',
        condition_value: '10000',
        action_type: 'add_step',
        action_config: { step_role: 'director', step_name: 'Director Approval' },
      },
      {
        name: 'Travel → Finance Required',
        description: 'If category is Travel, add Finance approval step',
        condition_type: 'category',
        operator: '=',
        condition_value: 'Travel',
        action_type: 'add_step',
        action_config: { step_role: 'finance', step_name: 'Finance Review' },
      },
      {
        name: 'Low Amount Auto-Approve',
        description: 'If expense amount < ₹500, auto-approve',
        condition_type: 'amount',
        operator: '<',
        condition_value: '500',
        action_type: 'auto_approve',
        action_config: {},
      },
    ];

    for (const rule of rulesData) {
      await client.query(
        `INSERT INTO workflow_rules (workflow_id, name, description, condition_type, operator, condition_value, action_type, action_config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [workflowId, rule.name, rule.description, rule.condition_type, rule.operator, rule.condition_value, rule.action_type, JSON.stringify(rule.action_config)]
      );
    }

    // Create conditional approval (CFO priority override + 60% threshold)
    await client.query(
      `INSERT INTO approval_conditions (workflow_id, condition_type, percentage_threshold, priority_approver_id, description)
       VALUES ($1, 'hybrid', 60.00, $2, 'If 60% approve OR CFO approves → Instantly approved')`,
      [workflowId, userIds.cfo]
    );

    // Create demo expenses
    const expensesData = [
      {
        submitter: userIds.employee1,
        category: categoryIds['Travel'],
        title: 'Delhi Business Trip',
        description: 'Flight + Hotel for client meeting in Delhi',
        amount: 15000,
        expense_date: '2026-03-25',
        status: 'pending',
      },
      {
        submitter: userIds.employee1,
        category: categoryIds['Food & Dining'],
        title: 'Team Lunch',
        description: 'Team lunch at office canteen',
        amount: 2500,
        expense_date: '2026-03-26',
        status: 'pending',
      },
      {
        submitter: userIds.employee2,
        category: categoryIds['Software'],
        title: 'Figma Pro License',
        description: 'Annual Figma Pro subscription for design work',
        amount: 8400,
        expense_date: '2026-03-20',
        status: 'approved',
      },
      {
        submitter: userIds.employee2,
        category: categoryIds['Office Supplies'],
        title: 'Stationery Purchase',
        description: 'Notebooks, pens, and folders for Q2',
        amount: 350,
        expense_date: '2026-03-22',
        status: 'approved',
      },
      {
        submitter: userIds.employee1,
        category: categoryIds['Client Entertainment'],
        title: 'Client Dinner',
        description: 'Dinner with ABC Corp representatives',
        amount: 5200,
        expense_date: '2026-03-27',
        status: 'in_review',
      },
    ];

    for (const exp of expensesData) {
      const expRes = await client.query(
        `INSERT INTO expenses (company_id, submitted_by, category_id, title, description, amount, expense_date, status, workflow_id, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [companyId, exp.submitter, exp.category, exp.title, exp.description, exp.amount, exp.expense_date, exp.status, workflowId]
      );

      // Create approval trail for pending expenses
      if (exp.status === 'pending' || exp.status === 'in_review') {
        await client.query(
          `INSERT INTO expense_approvals (expense_id, step_id, approver_id, decision)
           VALUES ($1, $2, $3, 'pending')`,
          [expRes.rows[0].id, stepIds.manager, userIds.manager]
        );
      }

      if (exp.status === 'approved') {
        await client.query(
          `INSERT INTO expense_approvals (expense_id, step_id, approver_id, decision, comments, decided_at)
           VALUES ($1, $2, $3, 'approved', 'Looks good, approved.', CURRENT_TIMESTAMP)`,
          [expRes.rows[0].id, stepIds.manager, userIds.manager]
        );
      }
    }

    // Create sample notifications
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_type)
       VALUES ($1, 'New Expense Submitted', 'Amit Verma submitted a ₹15,000 travel expense for approval', 'approval', 'expense')`,
      [userIds.manager]
    );
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Welcome to ExpenseFlow!', 'Your company account has been set up. Start by exploring the dashboard.', 'system')`,
      [userIds.admin]
    );

    console.log('🌱 Demo data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = seedDB;
