const express = require('express');
const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { name, required_count, store_id } = req.body;
    if (!name || !required_count || !store_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name, required_count, store_id 为必填项' });
    }
    const store = await db.get('SELECT id FROM stores WHERE id = ?', [store_id]);
    if (!store) {
      return res.status(404).json({ code: 'STORE_NOT_FOUND', message: '门店不存在' });
    }
    const id = 'task-' + Date.now();
    await db.run('INSERT INTO tasks (id, name, required_count, store_id, status) VALUES (?, ?, ?, ?, ?)', [id, name, required_count, store_id, 'pending']);
    const task = await db.get(`
      SELECT t.*, s.id as store_id, s.name as store_name, s.code as store_code
      FROM tasks t LEFT JOIN stores s ON t.store_id = s.id WHERE t.id = ?
    `, [id]);
    res.status(201).json({
      ...task,
      stores: task ? { id: task.store_id, name: task.store_name, code: task.store_code } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const rows = await db.all(`
      SELECT t.*, s.name as store_name, s.code as store_code
      FROM tasks t LEFT JOIN stores s ON t.store_id = s.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows.map(t => ({
      ...t,
      stores: { id: t.store_id, name: t.store_name, code: t.store_code },
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/store/:storeId', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { storeId } = req.params;
    const rows = await db.all('SELECT * FROM tasks WHERE store_id = ? ORDER BY created_at DESC', [storeId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
