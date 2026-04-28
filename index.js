const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
let dbType = 'none';
let mockData = null;

function loadMock() {
  const p = path.join(__dirname, 'mock.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function initDB() {
  if (MONGODB_URI) {
    const { connect } = require('./db');
    await connect(MONGODB_URI);
    const Store = require('./models/Store');
    const count = await Store.countDocuments();
    if (count === 0) {
      const mock = loadMock();
      const stores = mock?.stores || [
        { id: 'store-1', name: '北京朝阳店', code: 'BJ-CY-001', address: '北京市朝阳区建国路88号' },
        { id: 'store-2', name: '上海浦东店', code: 'SH-PD-001', address: '上海市浦东新区陆家嘴环路100号' },
        { id: 'store-3', name: '广州天河店', code: 'GZ-TH-001', address: '广州市天河区体育西路50号' },
        { id: 'store-4', name: '深圳南山店', code: 'SZ-NS-001', address: '深圳市南山区科技园路20号' },
      ];
      await Store.insertMany(stores);
      console.log(`✅ Seed ${stores.length} stores inserted`);
    }
    dbType = 'mongodb';
  } else {
    mockData = loadMock();
    if (!mockData) {
      console.error('❌ No MONGODB_URI and no mock.json found');
      process.exit(1);
    }
    dbType = 'mock';
    app.locals.mockData = mockData;
    console.log('✅ Mock mode (using mock.json)');
  }
}

const initPromise = initDB().catch((err) => {
  console.error('❌ DB init failed:', err.message);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initPromise
    .then(() => {
      app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log(`📦 Database: ${dbType === 'mongodb' ? '🍃 MongoDB' : '🎭 Mock Data'}`);
      });
    })
    .catch((err) => {
      console.error('❌ DB init failed:', err.message);
      process.exit(1);
    });
}

app.use(async (req, res, next) => {
  await initPromise;
  next();
});

app.use('/api/stores', require('./routes/stores'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/submissions', require('./routes/submissions'));

app.get('/health', async (req, res) => {
  try {
    if (dbType === 'mongodb') {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    } else if (dbType !== 'mock') {
      throw new Error('No database configured');
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: dbType });
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

module.exports = app;
