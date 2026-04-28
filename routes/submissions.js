const express = require('express');
const router = express.Router();

function isMock(req) { return !!req.app.locals.mockData; }
function mock(req) { return req.app.locals.mockData; }
function findTask(m, id) { return (m.tasks || []).find(t => t.id === id); }

router.post('/', async (req, res, next) => {
  try {
    const { task_id, actual_count } = req.body;
    if (!task_id || actual_count === undefined || actual_count === null) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'task_id 和 actual_count 为必填项' });
    }
    let task;
    if (isMock(req)) {
      task = findTask(mock(req), task_id);
    } else {
      const Task = require('../models/Task');
      task = await Task.findOne({ id: task_id });
    }
    if (!task) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' });
    }
    const result = actual_count < task.required_count ? 'failed' : 'passed';
    const sub = { id: 'sub-' + Date.now(), task_id, actual_count, result };
    if (isMock(req)) {
      const m = mock(req);
      m.submissions = m.submissions || [];
      m.submissions.push(sub);
      if (result === 'passed') {
        const t = findTask(m, task_id);
        if (t) t.status = 'completed';
      }
      return res.status(201).json({
        ...sub,
        validation: {
          required_count: task.required_count, actual_count, result,
          message: result === 'passed'
            ? `合格：实际排面数 ${actual_count} ≥ 要求数 ${task.required_count}`
            : `不达标：实际排面数 ${actual_count} < 要求数 ${task.required_count}，请整改`,
        },
      });
    }
    const Submission = require('../models/Submission');
    const Task = require('../models/Task');
    const submission = await Submission.create(sub);
    if (result === 'passed') {
      await Task.updateOne({ id: task_id }, { status: 'completed' });
    }
    res.status(201).json({
      ...submission.toObject(),
      validation: {
        required_count: task.required_count, actual_count, result,
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
    const { taskId } = req.query;
    if (isMock(req)) {
      const m = mock(req);
      let subs = m.submissions || [];
      if (taskId) subs = subs.filter(s => s.task_id === taskId);
      return res.json(subs.map(r => {
        const t = findTask(m, r.task_id);
        return {
          ...r,
          task_name: t?.name,
          required_count: t?.required_count,
          store_id: t?.store_id,
          tasks: t ? { id: r.task_id, name: t.name, required_count: t.required_count, store_id: t.store_id } : null,
        };
      }));
    }
    const Submission = require('../models/Submission');
    const Task = require('../models/Task');
    const Store = require('../models/Store');
    let submissions = taskId
      ? await Submission.find({ task_id: taskId }).sort({ submitted_at: -1 }).lean()
      : await Submission.find().sort({ submitted_at: -1 }).lean();
    const taskIds = [...new Set(submissions.map(s => s.task_id))];
    const tasks = await Task.find({ id: { $in: taskIds } }).lean();
    const storeIds = [...new Set(tasks.map(t => t.store_id))];
    const stores = await Store.find({ id: { $in: storeIds } }).lean();
    const taskMap = {}; for (const t of tasks) taskMap[t.id] = t;
    const storeMap = {}; for (const s of stores) storeMap[s.id] = s;
    res.json(submissions.map(r => ({
      ...r,
      task_name: taskMap[r.task_id]?.name,
      required_count: taskMap[r.task_id]?.required_count,
      store_id: taskMap[r.task_id]?.store_id,
      store_name: storeMap[taskMap[r.task_id]?.store_id]?.name,
      store_code: storeMap[taskMap[r.task_id]?.store_id]?.code,
      tasks: {
        id: r.task_id,
        name: taskMap[r.task_id]?.name,
        required_count: taskMap[r.task_id]?.required_count,
        store_id: taskMap[r.task_id]?.store_id,
        stores: { id: taskMap[r.task_id]?.store_id, name: storeMap[taskMap[r.task_id]?.store_id]?.name, code: storeMap[taskMap[r.task_id]?.store_id]?.code },
      },
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
