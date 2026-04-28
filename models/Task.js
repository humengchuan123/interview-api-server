const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  required_count: { type: Number, required: true },
  store_id: { type: String, required: true, ref: 'Store' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
