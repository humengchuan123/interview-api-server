const express = require('express');
const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { name, required_count, store_id } = req.body;
    if (!name || !required_count || !store_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name, required_count, store_id 为必填项' });
    }
    const id = 'task-' + Date.now();
    db.prepare('INSERT INTO tasks (id, name, required_count, store_id, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, required_count, store_id, 'pending');
    const task = db.prepare(`
      SELECT t.*, s.id as store_id, s.name as store_name, s.code as store_code
      FROM tasks t
      LEFT JOIN stores s ON t.store_id = s.id
      WHERE t.id = ?
    `).get(id);
    res.status(201).json({
      ...task,
      stores: task ? { id: task.store_id, name: task.store_name, code: task.store_code } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const tasks = db.prepare(`
      SELECT t.*, s.name as store_name, s.code as store_code
      FROM tasks t
      LEFT JOIN stores s ON t.store_id = s.id
      ORDER BY t.created_at DESC
    `).all();
    res.json(tasks.map(t => ({
      ...t,
      stores: { id: t.store_id, name: t.store_name, code: t.store_code },
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/store/:storeId', (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { storeId } = req.params;
    const tasks = db.prepare('SELECT * FROM tasks WHERE store_id = ? ORDER BY created_at DESC').all(storeId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
