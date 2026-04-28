const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Task = require('../models/Task');
const Store = require('../models/Store');

router.post('/', async (req, res, next) => {
  try {
    const { task_id, actual_count } = req.body;
    if (!task_id || actual_count === undefined || actual_count === null) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'task_id 和 actual_count 为必填项' });
    }
    const task = await Task.findOne({ id: task_id });
    if (!task) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '任务不存在' });
    }

    const result = actual_count < task.required_count ? 'failed' : 'passed';
    const id = 'sub-' + Date.now();

    const submission = await Submission.create({ id, task_id, actual_count, result });

    if (result === 'passed') {
      await Task.updateOne({ id: task_id }, { status: 'completed' });
    }

    res.status(201).json({
      ...submission.toObject(),
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
    const { taskId } = req.query;
    let submissions;
    if (taskId) {
      submissions = await Submission.find({ task_id: taskId }).sort({ submitted_at: -1 }).lean();
    } else {
      submissions = await Submission.find().sort({ submitted_at: -1 }).lean();
    }

    const taskIds = [...new Set(submissions.map(s => s.task_id))];
    const tasks = await Task.find({ id: { $in: taskIds } }).lean();
    const storeIds = [...new Set(tasks.map(t => t.store_id))];
    const stores = await Store.find({ id: { $in: storeIds } }).lean();

    const taskMap = {};
    for (const t of tasks) taskMap[t.id] = t;
    const storeMap = {};
    for (const s of stores) storeMap[s.id] = s;

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
