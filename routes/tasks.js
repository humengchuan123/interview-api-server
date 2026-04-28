const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Store = require('../models/Store');

router.post('/', async (req, res, next) => {
  try {
    const { name, required_count, store_id } = req.body;
    if (!name || !required_count || !store_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name, required_count, store_id 为必填项' });
    }
    const store = await Store.findOne({ id: store_id });
    if (!store) {
      return res.status(404).json({ code: 'STORE_NOT_FOUND', message: '门店不存在' });
    }
    const id = 'task-' + Date.now();
    const task = await Task.create({ id, name, required_count, store_id, status: 'pending' });
    res.status(201).json({
      ...task.toObject(),
      stores: { id: store.id, name: store.name, code: store.code },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find().sort({ created_at: -1 }).lean();
    const storeIds = [...new Set(tasks.map(t => t.store_id))];
    const stores = await Store.find({ id: { $in: storeIds } }).lean();
    const storeMap = {};
    for (const s of stores) storeMap[s.id] = s;
    res.json(tasks.map(t => ({
      ...t,
      store_name: storeMap[t.store_id]?.name,
      store_code: storeMap[t.store_id]?.code,
      stores: { id: t.store_id, name: storeMap[t.store_id]?.name, code: storeMap[t.store_id]?.code },
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/store/:storeId', async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const rows = await Task.find({ store_id: storeId }).sort({ created_at: -1 });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
