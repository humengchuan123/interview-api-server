const express = require('express');
const router = express.Router();

function isMock(req) { return !!req.app.locals.mockData; }
function mock(req) { return req.app.locals.mockData; }

router.get('/', async (req, res, next) => {
  try {
    if (isMock(req)) {
      return res.json(mock(req).stores || []);
    }
    const Store = require('../models/Store');
    const rows = await Store.find().sort({ created_at: -1 });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name 和 code 为必填项' });
    }
    const id = 'store-' + Date.now();
    const store = { id, name, code, address: address || null };
    if (isMock(req)) {
      const m = mock(req);
      m.stores.push(store);
      return res.status(201).json(store);
    }
    const Store = require('../models/Store');
    const result = await Store.create(store);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
