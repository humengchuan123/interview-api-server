const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const stores = db.prepare('SELECT * FROM stores ORDER BY created_at DESC').all();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name 和 code 为必填项' });
    }
    const id = 'store-' + Date.now();
    db.prepare('INSERT INTO stores (id, name, code, address) VALUES (?, ?, ?, ?)').run(id, name, code, address || null);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    res.status(201).json(store);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 'DUPLICATE_CODE', message: '门店编码已存在' });
    }
    next(err);
  }
});

module.exports = router;
