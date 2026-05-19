const Preference = require('../models/Preference');

/**
 * Increments and updates user preference history based on a successful booking.
 * @param {string} userId - ID of the booking user
 * @param {object} booking - The created booking document
 */
const updatePreferences = async (userId, booking) => {
  if (!userId || !booking) return null;

  const service = booking.service || 'AC Repair';
  const area = booking.location ? booking.location.split(',')[0].trim() : 'G-13';

  // Helper to extract hour and infer preferred time of day
  const getHour = (timeStr) => {
    if (!timeStr) return 12;
    const match24 = timeStr.match(/(\d{2}):(\d{2})/);
    if (match24) return parseInt(match24[1], 10);
    const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let hr = parseInt(match12[1], 10);
      const ampm = match12[3].toUpperCase();
      if (ampm === 'PM' && hr < 12) hr += 12;
      if (ampm === 'AM' && hr === 12) hr = 0;
      return hr;
    }
    return 12;
  };

  const hour = getHour(booking.scheduled_datetime);
  let timeOfDay = 'afternoon';
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else timeOfDay = 'evening';

  // Find or initialize preferences record
  let pref = await Preference.findOne({ user_id: userId });
  if (!pref) {
    pref = new Preference({
      user_id: userId,
      preferred_services: [],
      preferred_areas: [],
      preferred_time_of_day: timeOfDay,
      last_updated: new Date()
    });
  }

  // 1. Update preferred service
  const svcIndex = pref.preferred_services.findIndex(s => s.service === service);
  if (svcIndex >= 0) {
    pref.preferred_services[svcIndex].count += 1;
  } else {
    pref.preferred_services.push({ service, count: 1 });
  }

  // 2. Update preferred area
  const areaIndex = pref.preferred_areas.findIndex(a => a.area === area);
  if (areaIndex >= 0) {
    pref.preferred_areas[areaIndex].count += 1;
  } else {
    pref.preferred_areas.push({ area, count: 1 });
  }

  // 3. Sort arrays in descending count order
  pref.preferred_services.sort((a, b) => b.count - a.count);
  pref.preferred_areas.sort((a, b) => b.count - a.count);

  // 4. Update general metrics
  pref.preferred_time_of_day = timeOfDay;
  pref.last_updated = new Date();

  await pref.save();
  return pref;
};

module.exports = {
  updatePreferences
};
