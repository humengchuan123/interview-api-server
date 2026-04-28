const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  address: String,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Store || mongoose.model('Store', storeSchema);
