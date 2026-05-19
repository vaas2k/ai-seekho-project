const mongoose = require('mongoose');

const FollowupSchema = new mongoose.Schema({
  booking_id: {
    type: String,
    required: true,
  },
  user_id: {
    type: String,
    required: true,
  },
  step: {
    type: Number,
    required: true,
  },
  trigger_label: {
    type: String,
    required: true,
  },
  trigger_datetime: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  channel: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  action_button: {
    type: String,
    required: false,
  },
  sent: {
    type: Boolean,
    default: false,
  },
  sent_at: {
    type: Date,
    required: false,
  },
}, { 
  timestamps: true 
});

// Index for dispatching queries
FollowupSchema.index({ booking_id: 1, sent: 1 });

module.exports = mongoose.model('Followup', FollowupSchema);
