const express = require('express');
const router = express.Router();
const Store = require('../models/Store');

router.get('/', async (req, res, next) => {
  try {
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
    const store = await Store.create({ id, name, code, address: address || null });
    res.status(201).json(store);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
