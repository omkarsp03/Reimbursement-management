const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dbPath = path.join(__dirname, '../data/expenseflow.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open the SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
  } else {
    console.log('📦 Connected to local SQLite database at:', dbPath);
  }
});

// Create a pool-like wrapper for SQLite to maintain compatibility with existing code
const pool = {
  connect: async () => {
    return {
      query: async (text, params) => {
        // Convert $1, $2... to ? for SQLite
        const sqliteQuery = text.replace(/\$(\d+)/g, '?');
        
        return new Promise((resolve, reject) => {
          if (text.trim().toUpperCase().startsWith('SELECT')) {
            db.all(sqliteQuery, params, (err, rows) => {
              if (err) reject(err);
              else resolve({ rows, rowCount: rows.length });
            });
          } else {
            db.run(sqliteQuery, params, function(err) {
              if (err) reject(err);
              else resolve({ 
                rows: this.lastID ? [{ id: this.lastID }] : [], 
                rowCount: this.changes 
              });
            });
          }
        });
      },
      release: () => {}
    };
  },
  query: async (text, params) => {
    const client = await pool.connect();
    return client.query(text, params);
  }
};

module.exports = pool;
