const express = require('express');
const router = express.Router();

function isMock(req) { return !!req.app.locals.mockData; }
function mock(req) { return req.app.locals.mockData; }

function findStore(m, id) { return (m.stores || []).find(s => s.id === id); }

router.post('/', async (req, res, next) => {
  try {
    const { name, required_count, store_id } = req.body;
    if (!name || !required_count || !store_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name, required_count, store_id 为必填项' });
    }
    let store;
    if (isMock(req)) {
      store = findStore(mock(req), store_id);
    } else {
      const Store = require('../models/Store');
      store = await Store.findOne({ id: store_id });
    }
    if (!store) {
      return res.status(404).json({ code: 'STORE_NOT_FOUND', message: '门店不存在' });
    }
    const task = { id: 'task-' + Date.now(), name, required_count, store_id, status: 'pending' };
    if (isMock(req)) {
      const m = mock(req);
      m.tasks = m.tasks || [];
      m.tasks.push(task);
      return res.status(201).json({ ...task, stores: { id: store.id, name: store.name, code: store.code } });
    }
    const Task = require('../models/Task');
    const result = await Task.create(task);
    res.status(201).json({ ...result.toObject(), stores: { id: store.id, name: store.name, code: store.code } });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (isMock(req)) {
      const m = mock(req);
      const tasks = m.tasks || [];
      return res.json(tasks.map(t => ({
        ...t,
        store_name: findStore(m, t.store_id)?.name,
        store_code: findStore(m, t.store_id)?.code,
        stores: { id: t.store_id, name: findStore(m, t.store_id)?.name, code: findStore(m, t.store_id)?.code },
      })));
    }
    const Task = require('../models/Task');
    const Store = require('../models/Store');
    const tasks = await Task.find().sort({ created_at: -1 }).lean();
    const storeIds = [...new Set(tasks.map(t => t.store_id))];
    const stores = await Store.find({ id: { $in: storeIds } }).lean();
    const map = {};
    for (const s of stores) map[s.id] = s;
    res.json(tasks.map(t => ({
      ...t,
      store_name: map[t.store_id]?.name,
      store_code: map[t.store_id]?.code,
      stores: { id: t.store_id, name: map[t.store_id]?.name, code: map[t.store_id]?.code },
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/store/:storeId', async (req, res, next) => {
  try {
    const { storeId } = req.params;
    if (isMock(req)) {
      return res.json((mock(req).tasks || []).filter(t => t.store_id === storeId));
    }
    const Task = require('../models/Task');
    res.json(await Task.find({ store_id: storeId }).sort({ created_at: -1 }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
