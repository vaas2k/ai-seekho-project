const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider');

// GET /api/providers
router.get('/', async (req, res, next) => {
  const { city, service, active } = req.query;

  // Build dynamic MongoDB query filters
  const filter = {};

  // Active status filter (default: true)
  filter.active = active !== 'false';

  if (city) {
    // Case-insensitive city search matching
    filter.city = { $regex: new RegExp(`^${city}$`, 'i') };
  }

  if (service) {
    // Checks if the requested service is in the provider's covered service_types array
    filter.service_types = { $in: [service] };
  }

  try {
    // Exclude available_slots for response brevity as requested
    const providers = await Provider.find(filter).select('-available_slots');
    res.status(200).json(providers);
  } catch (err) {
    next(err);
  }
});

// GET /api/providers/:id
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const provider = await Provider.findById(id);
    if (!provider) {
      return res.status(404).json({ error: `Provider with ID ${id} not found.` });
    }
    res.status(200).json(provider);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
