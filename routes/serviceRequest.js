const express = require('express');
const router = express.Router();
const orchestrator = require('../agents/orchestrator');
const Booking = require('../models/Booking');
const Preference = require('../models/Preference');
const { validateBody } = require('../middleware/validate');

// Validation Schemas
const serviceRequestSchema = {
  message: { required: true, type: 'string', maxLength: 500 },
  userId: { required: true, type: 'string' }
};

const confirmBookingSchema = {
  decision: { required: true, type: 'object' },
  intent: { required: true }, // Multi-type safe
  userId: { required: true, type: 'string' }
};

const clarifySchema = {
  answer: { required: true, type: 'string' },
  originalMessage: { required: true, type: 'string' },
  userId: { required: true, type: 'string' }
};

// POST /api/service-request
router.post(
  '/service-request',
  validateBody(serviceRequestSchema),
  async (req, res, next) => {
    const { message, userId } = req.body;

    try {
      const pipelineOutcome = await orchestrator.handleServiceRequest(message, userId);
      res.status(200).json(pipelineOutcome);
    } catch (err) {
      console.error('Service request error:', err.message);
      res.status(500).json({
        error: err.message || 'Pipeline failed during agent execution.',
        agent: 'AG1 - Intent Parser', // Failed agent identification fallback
      });
    }
  }
);

// POST /api/confirm-booking
router.post(
  '/confirm-booking',
  validateBody(confirmBookingSchema),
  async (req, res, next) => {
    const { decision, intent, userId } = req.body;

    try {
      const bookingResult = await orchestrator.executeBooking(decision, intent, userId);
      res.status(201).json(bookingResult);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/clarify
router.post(
  '/clarify',
  validateBody(clarifySchema),
  async (req, res, next) => {
    const { answer, originalMessage, userId } = req.body;

    try {
      const enrichedMessage = `${originalMessage} ${answer}`;
      console.log(`Clarity enriched prompt payload: "${enrichedMessage}"`);
      const pipelineOutcome = await orchestrator.handleServiceRequest(enrichedMessage, userId);
      res.status(200).json(pipelineOutcome);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/trace/:bookingId
router.get('/trace/:bookingId', async (req, res, next) => {
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findOne({ booking_id: bookingId });
    if (!booking) {
      return res.status(404).json({ error: `Booking record with ID ${bookingId} not found.` });
    }

    res.status(200).json({
      booking_id: booking.booking_id,
      agent_trace: booking.agent_trace,
      created_at: booking.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/state/:bookingId
router.get('/state/:bookingId', async (req, res, next) => {
  const { bookingId } = req.params;

  try {
    const demoData = await orchestrator.getStateChangeDemo(bookingId);
    if (!demoData) {
      return res.status(404).json({ error: `Booking record with ID ${bookingId} not found.` });
    }

    res.status(200).json(demoData);
  } catch (err) {
    next(err);
  }
});

// GET /api/preferences/:userId
router.get('/preferences/:userId', async (req, res, next) => {
  const { userId } = req.params;

  try {
    const preference = await Preference.findOne({ user_id: userId });
    if (!preference) {
      return res.status(200).json({
        user_id: userId,
        preferred_services: [],
        preferred_areas: [],
        preferred_time_of_day: 'afternoon',
        last_updated: null
      });
    }
    res.status(200).json(preference);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
