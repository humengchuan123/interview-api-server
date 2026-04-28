const express = require('express');
const cors = require('cors');
const { connect } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

async function initDB() {
  if (MONGODB_URI) {
    await connect(MONGODB_URI);
    const Store = require('./models/Store');
    const count = await Store.countDocuments();
    if (count === 0) {
      await Store.insertMany([
        { id: 'store-1', name: '北京朝阳店', code: 'BJ-CY-001', address: '北京市朝阳区建国路88号' },
        { id: 'store-2', name: '上海浦东店', code: 'SH-PD-001', address: '上海市浦东新区陆家嘴环路100号' },
        { id: 'store-3', name: '广州天河店', code: 'GZ-TH-001', address: '广州市天河区体育西路50号' },
        { id: 'store-4', name: '深圳南山店', code: 'SZ-NS-001', address: '深圳市南山区科技园路20号' },
      ]);
      console.log('✅ Seed stores inserted');
    }
  } else {
    console.log('⚠️ MONGODB_URI not set, using local mode');
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
        env: MONGODB_URI ? 'MONGODB_URI is set' : 'MONGODB_URI is NOT set',
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
    if (!MONGODB_URI) throw new Error('No database configured');
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: 'mongodb' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database not connected', detail: err.message });
  }
});

app.use((err, req, res, _next) => {
  console.error(err);
  if (err.code === 11000 || (err.message && err.message.includes('duplicate'))) {
    return res.status(400).json({ code: 'DUPLICATE_CODE', message: '编码已存在' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
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
        console.log(`📦 Database: ${MONGODB_URI ? '🍃 MongoDB' : '💾 No DB configured'}`);
      });
    })
    .catch((err) => {
      console.error('❌ Database initialization failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
