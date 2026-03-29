const pool = require('./db');

const initDB = async () => {
  const client = await pool.connect();
  try {
    // SQLite doesn't support full BEGIN/COMMIT in the same way with this wrapper
    // but we can simulate the sequential table creation.

    // Companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        base_currency VARCHAR(10) DEFAULT 'INR',
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT '📋',
        color VARCHAR(20) DEFAULT '#6366f1',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'employee', 'manager', 'finance', 'director', 'cfo')),
        department VARCHAR(100),
        manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Workflows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        flow_type VARCHAR(20) DEFAULT 'sequential' CHECK (flow_type IN ('sequential', 'parallel', 'hybrid')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Workflow Steps table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        approver_role VARCHAR(50),
        approver_ids TEXT, -- SQLite stores arrays as TEXT (JSON)
        step_type VARCHAR(20) DEFAULT 'sequential' CHECK (step_type IN ('sequential', 'parallel')),
        approval_threshold FLOAT DEFAULT 100.00,
        priority_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        can_skip BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Workflow Rules table (Rule-Based Logic Engine)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('amount', 'category', 'role', 'department')),
        operator VARCHAR(20) NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=', 'in', 'not_in')),
        condition_value TEXT NOT NULL,
        action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('add_step', 'skip_step', 'set_priority', 'auto_approve', 'auto_reject')),
        action_config TEXT DEFAULT '{}', -- SQLite JSONB equivalent
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Conditional Approval Rules
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        step_id INTEGER REFERENCES workflow_steps(id) ON DELETE CASCADE,
        condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('percentage', 'priority', 'hybrid')),
        percentage_threshold FLOAT,
        priority_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        submitted_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        amount FLOAT NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        converted_amount FLOAT,
        expense_date DATE NOT NULL,
        receipt_url TEXT,
        receipt_data TEXT DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'in_review', 'approved', 'rejected', 'cancelled')),
        workflow_id INTEGER REFERENCES workflows(id),
        current_step_id INTEGER REFERENCES workflow_steps(id),
        is_duplicate BOOLEAN DEFAULT false,
        duplicate_of INTEGER REFERENCES expenses(id),
        metadata TEXT DEFAULT '{}',
        submitted_at TIMESTAMP,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Expense Approvals (Audit Trail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        step_id INTEGER REFERENCES workflow_steps(id),
        approver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected', 'pending', 'skipped')),
        comments TEXT,
        decided_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'approval', 'approved', 'rejected', 'warning', 'system')),
        reference_type VARCHAR(50),
        reference_id INTEGER,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for performance (SQLite uses the same syntax)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_submitted_by ON expenses(submitted_by);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expense_approvals_expense ON expense_approvals(expense_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expense_approvals_approver ON expense_approvals(approver_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_workflow_rules_workflow ON workflow_rules(workflow_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = initDB;
