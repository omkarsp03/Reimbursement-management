const express = require('express');
const cors = require('cors');
require('dotenv').config();

const initDB = require('./config/initDB');
const seedDB = require('./config/seedDB');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const workflowRoutes = require('./routes/workflows');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.url !== '/api/health') {
      console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

const start = async () => {
  try {
    console.log('\n-------------------------------------------');
    console.log('📦 Starting ExpenseFlow Backend...');
    console.log('-------------------------------------------');
    
    await initDB();
    await seedDB();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Server status: \x1b[32mRUNNING\x1b[0m`);
      console.log(`🔗 Local URL:    \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
      console.log(`📊 Health Check: \x1b[36mhttp://localhost:${PORT}/api/health\x1b[0m`);
      console.log(`🔑 Demo Login:   \x1b[33madmin@techcorp.com / Demo@123\x1b[0m`);
      console.log('-------------------------------------------\n');
    });
  } catch (error) {
    console.error('\x1b[31mFailed to start server:\x1b[0m', error);
    process.exit(1);
  }
};

start();
