const express = require('express');
const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { task_id, actual_count } = req.body;
    if (!task_id || actual_count === undefined || actual_count === null) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'task_id 和 actual_count 为必填项' });
    }

    const task = await db.get('SELECT required_count, store_id FROM tasks WHERE id = ?', [task_id]);
    if (!task) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' });
    }

    const result = actual_count < task.required_count ? 'failed' : 'passed';
    const id = 'sub-' + Date.now();

    await db.run('INSERT INTO submissions (id, task_id, actual_count, result) VALUES (?, ?, ?, ?)', [id, task_id, actual_count, result]);

    if (result === 'passed') {
      await db.run('UPDATE tasks SET status = ? WHERE id = ?', ['completed', task_id]);
    }

    const submission = await db.get('SELECT * FROM submissions WHERE id = ?', [id]);

    res.status(201).json({
      ...submission,
      validation: {
        required_count: task.required_count,
        actual_count,
        result,
        message: result === 'passed'
          ? `合格：实际排面数 ${actual_count} ≥ 要求数 ${task.required_count}`
          : `不达标：实际排面数 ${actual_count} < 要求数 ${task.required_count}，请整改`,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { taskId } = req.query;

    let rows;
    if (taskId) {
      rows = await db.all(`
        SELECT sub.*, t.name as task_name, t.required_count, t.store_id,
               s.name as store_name, s.code as store_code
        FROM submissions sub
        LEFT JOIN tasks t ON sub.task_id = t.id
        LEFT JOIN stores s ON t.store_id = s.id
        WHERE sub.task_id = ?
        ORDER BY sub.submitted_at DESC
      `, [taskId]);
    } else {
      rows = await db.all(`
        SELECT sub.*, t.name as task_name, t.required_count, t.store_id,
               s.name as store_name, s.code as store_code
        FROM submissions sub
        LEFT JOIN tasks t ON sub.task_id = t.id
        LEFT JOIN stores s ON t.store_id = s.id
        ORDER BY sub.submitted_at DESC
      `);
    }

    res.json(rows.map(r => ({
      ...r,
      tasks: {
        id: r.task_id,
        name: r.task_name,
        required_count: r.required_count,
        store_id: r.store_id,
        stores: { id: r.store_id, name: r.store_name, code: r.store_code },
      },
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
