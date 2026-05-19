const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  booking_id: {
    type: String,
    required: true,
    unique: true,
  },
  user_id: {
    type: String,
    required: true,
  },
  provider_id: {
    type: String,
    required: true,
  },
  provider_name: {
    type: String,
    required: true,
  },
  service: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  scheduled_datetime: {
    type: String,
    required: true,
  },
  estimated_duration_hours: {
    type: Number,
    required: true,
  },
  estimated_price_pkr: {
    type: Number,
    required: true,
  },
  payment_method: {
    type: String,
    default: 'cash_on_delivery',
  },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled'],
    default: 'confirmed',
  },
  confirmation_messages: {
    english: { type: String, required: true },
    roman_urdu: { type: String, required: true },
  },
  system_state_change: {
    before: { type: String, required: true },
    after: { type: String, required: true },
  },
  simulated_actions: {
    type: [String],
    default: [],
  },
  agent_trace: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true 
});

// Indexes for high performance queries and uniqueness
BookingSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('Booking', BookingSchema);
