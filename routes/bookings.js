const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// GET /api/bookings/:userId
router.get('/:userId', async (req, res, next) => {
  const { userId } = req.params;

  try {
    const bookings = await Booking.find({ user_id: userId }).sort({ created_at: -1 });
    res.status(200).json(bookings || []);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/detail/:bookingId
router.get('/detail/:bookingId', async (req, res, next) => {
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findOne({ booking_id: bookingId });
    if (!booking) {
      return res.status(404).json({ error: `Booking detail for ID ${bookingId} not found.` });
    }
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
