const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  task_id: { type: String, required: true, ref: 'Task' },
  actual_count: { type: Number, required: true },
  result: { type: String, enum: ['passed', 'failed'], required: true },
  submitted_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
