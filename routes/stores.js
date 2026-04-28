const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const rows = await db.all('SELECT * FROM stores ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name 和 code 为必填项' });
    }
    const id = 'store-' + Date.now();
    await db.run('INSERT INTO stores (id, name, code, address) VALUES (?, ?, ?, ?)', [id, name, code, address || null]);
    const store = await db.get('SELECT * FROM stores WHERE id = ?', [id]);
    res.status(201).json(store);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
