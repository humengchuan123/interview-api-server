const express = require('express');
const cors = require('cors');
const path = require('path');
const { SqliteAdapter, SupabaseAdapter } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const isSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

async function initDB() {
  if (isSupabase) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const adapter = new SupabaseAdapter(supabase);
    app.locals.db = adapter;

    const { count, error: countErr } = await supabase.from('stores').select('*', { count: 'exact', head: true });
    if (countErr || count === 0) {
      const { error: insertErr } = await supabase.from('stores').insert([
        { id: 'store-1', name: '北京朝阳店', code: 'BJ-CY-001', address: '北京市朝阳区建国路88号' },
        { id: 'store-2', name: '上海浦东店', code: 'SH-PD-001', address: '上海市浦东新区陆家嘴环路100号' },
        { id: 'store-3', name: '广州天河店', code: 'GZ-TH-001', address: '广州市天河区体育西路50号' },
        { id: 'store-4', name: '深圳南山店', code: 'SZ-NS-001', address: '深圳市南山区科技园路20号' },
      ]);
      if (insertErr && insertErr.code !== '23505') console.error('Seed error:', insertErr.message);
    }

    const { error: tableCheck } = await supabase.from('tasks').select('id', { count: 'exact', head: true });
    if (tableCheck && tableCheck.code === '42P01') {
      throw new Error('Table "tasks" not found. Please create tables first in Supabase SQL Editor.');
    }
  } else {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'data.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const adapter = new SqliteAdapter(db);
    app.locals.db = adapter;

    db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
        address TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, required_count INTEGER NOT NULL,
        store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        actual_count INTEGER NOT NULL, result TEXT NOT NULL,
        submitted_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    const storeCount = db.prepare('SELECT COUNT(*) as count FROM stores').get();
    if (storeCount.count === 0) {
      const insert = db.prepare('INSERT INTO stores (id, name, code, address) VALUES (?, ?, ?, ?)');
      const seed = db.transaction((data) => { for (const s of data) insert.run(...s); });
      seed([
        ['store-1', '北京朝阳店', 'BJ-CY-001', '北京市朝阳区建国路88号'],
        ['store-2', '上海浦东店', 'SH-PD-001', '上海市浦东新区陆家嘴环路100号'],
        ['store-3', '广州天河店', 'GZ-TH-001', '广州市天河区体育西路50号'],
        ['store-4', '深圳南山店', 'SZ-NS-001', '深圳市南山区科技园路20号'],
      ]);
    }
  }
}

let dbReady = false;
let dbError = null;

const initPromise = initDB()
  .then(() => { dbReady = true; })
  .catch((err) => {
    dbError = err;
    console.error('❌ DB init error:', err.message);
  });

app.use(async (req, res, next) => {
  if (!dbReady) {
    await initPromise;
    if (dbError) {
      return res.status(503).json({
        code: 'DB_INIT_FAILED',
        message: '数据库初始化失败',
        detail: dbError.message,
        env: isSupabase ? 'SUPABASE configured' : 'Using SQLite (local)',
      });
    }
  }
  next();
});

app.use('/api/stores', require('./routes/stores'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/submissions', require('./routes/submissions'));

app.get('/health', async (req, res) => {
  try {
    await req.app.locals.db.get('SELECT 1 as ok');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: isSupabase ? 'supabase' : 'sqlite' });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: 'Database not connected',
      detail: err.message,
      env: isSupabase ? 'SUPABASE configured' : 'Using SQLite (local)',
    });
  }
});

app.use((err, req, res, _next) => {
  console.error(err);
  const isDuplicate = err.code === '23505' || (err.message && err.message.includes('UNIQUE'));
  const isFK = err.code === '23503' || (err.message && err.message.includes('FOREIGN KEY'));
  if (isDuplicate) {
    return res.status(400).json({ code: 'DUPLICATE_CODE', message: '编码已存在' });
  }
  if (isFK) {
    return res.status(400).json({ code: 'FOREIGN_KEY_VIOLATION', message: '关联记录不存在' });
  }
  res.status(err.statusCode || 500).json({
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误',
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDB()
    .then(() => {
      dbReady = true;
      app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log(`📦 Database: ${isSupabase ? '☁️ Supabase (REST API)' : '💾 SQLite (local)'}`);
      });
    })
    .catch((err) => {
      console.error('❌ Database initialization failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
