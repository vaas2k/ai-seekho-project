const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  owner_name: {
    type: String,
    required: true,
  },
  service_types: {
    type: [String],
    required: true,
  },
  service_types_urdu: {
    type: [String],
    required: false,
  },
  areas_covered: {
    type: [String],
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  base_location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    area: { type: String, required: true },
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  total_jobs_completed: {
    type: Number,
    default: 0,
  },
  cancellation_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  avg_response_time_minutes: {
    type: Number,
    required: true,
  },
  trust_score: {
    type: Number,
    required: true,
  },
  available_slots: {
    monday: { type: [String], required: true },
    tuesday: { type: [String], required: true },
    wednesday: { type: [String], required: true },
    thursday: { type: [String], required: true },
    friday: { type: [String], required: true },
    saturday: { type: [String], required: true },
    sunday: { type: [String], required: true },
  },
  price_range_pkr: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  languages_spoken: {
    type: [String],
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true,
  _id: false, // Ensure Mongoose respects our custom String _id instead of generating ObjectId
});

// Indexes for high performance searching
ProviderSchema.index({ city: 1, active: 1 });
ProviderSchema.index({ service_types: 1 });

module.exports = mongoose.model('Provider', ProviderSchema);
