const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    required_count INTEGER NOT NULL,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actual_count INTEGER NOT NULL,
    result TEXT NOT NULL,
    submitted_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

const storeCount = db.prepare('SELECT COUNT(*) as count FROM stores').get();
if (storeCount.count === 0) {
  const insertStore = db.prepare('INSERT INTO stores (id, name, code, address) VALUES (?, ?, ?, ?)');
  const seedStores = [
    ['store-1', '北京朝阳店', 'BJ-CY-001', '北京市朝阳区建国路88号'],
    ['store-2', '上海浦东店', 'SH-PD-001', '上海市浦东新区陆家嘴环路100号'],
    ['store-3', '广州天河店', 'GZ-TH-001', '广州市天河区体育西路50号'],
    ['store-4', '深圳南山店', 'SZ-NS-001', '深圳市南山区科技园路20号'],
  ];
  const insertMany = db.transaction((stores) => {
    for (const s of stores) insertStore.run(...s);
  });
  insertMany(seedStores);
}

app.locals.db = db;

app.use('/api/stores', require('./routes/stores'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/submissions', require('./routes/submissions'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误',
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📊 SQLite database: ${dbPath}`);
  });
}

module.exports = app;
