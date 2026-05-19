const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
  },
  state: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  last_message: {
    type: String,
    required: false,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Session', SessionSchema);
