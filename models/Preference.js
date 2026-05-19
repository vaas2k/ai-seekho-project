const mongoose = require('mongoose');

const PreferenceSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  preferred_services: [{
    service: { type: String, required: true },
    count: { type: Number, required: true, default: 1 }
  }],
  preferred_areas: [{
    area: { type: String, required: true },
    count: { type: Number, required: true, default: 1 }
  }],
  preferred_time_of_day: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    default: 'afternoon'
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Preference', PreferenceSchema);
