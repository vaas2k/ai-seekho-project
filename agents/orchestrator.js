const prompts = require('./prompts');
const { callClaude } = require('./callClaude');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Followup = require('../models/Followup');
const Preference = require('../models/Preference');

// --- Helper: Programmatic Trust Score calculation ---
const calculateTrustScore = (rating, totalJobs, cancellationRate, avgResponseTime) => {
  const ratingTerm = (rating / 5) * 40;
  const jobsTerm = Math.min(totalJobs / 200, 1) * 30;
  const cancelTerm = (1 - cancellationRate) * 20;
  const responseTerm = (1 - (avgResponseTime / 60)) * 10;
  return parseFloat((ratingTerm + jobsTerm + cancelTerm + responseTerm).toFixed(1));
};

const handleServiceRequest = async (message, userId = 'user_123') => {
  console.log(`[Orchestrator:handleServiceRequest] === START ===`);
  console.log(`[Orchestrator:handleServiceRequest] Input Parameters -> message: "${message}", userId: "${userId}"`);

  // Step 1: Initialize trace array and datetime variables
  const trace = [];
  const now = new Date();
  const datetime = now.toISOString().slice(0, 16).replace("T", " ");
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  
  console.log(`[Orchestrator:handleServiceRequest] Step 1: Extracted Datetime: "${datetime}", Day of Week: "${dayOfWeek}"`);

  try {
    // Step 2: Load and run Agent 1
    // Load ag1 system prompt from file: prompts.ag1
    // Inject: user_message, current_datetime, day_of_week
    const ag1Input = {
      user_message: message,
      current_datetime: datetime,
      day_of_week: dayOfWeek,
      raw_text: message,
      userId: userId
    };

    console.log(`[Orchestrator:handleServiceRequest] Step 2: Invoking callClaude for 'ag1' (Intent Parser)... Input:`, JSON.stringify(ag1Input, null, 2));

    const ag1Result = await callClaude(
      prompts.ag1(),
      prompts.inject(prompts.ag1User(), ag1Input),
      'ag1'
    );

    console.log(`[Orchestrator:handleServiceRequest] Step 2: ag1 returned with result:`, JSON.stringify(ag1Result, null, 2));

    trace.push(ag1Result);

    if (!ag1Result || !ag1Result.success) {
      console.error(`[Orchestrator:handleServiceRequest] Error: ag1 call was unsuccessful or empty.`);
      return { type: "error", message: "Intent parsing failed", trace };
    }

    const intent = ag1Result.output;
    if (!intent) {
      console.error(`[Orchestrator:handleServiceRequest] Error: ag1 Result was successful but 'output' is missing or null.`);
      return { type: "error", message: "Intent parsing failed: empty response", trace };
    }

    console.log(`[Orchestrator:handleServiceRequest] Step 2 Success: Parsed Intent:`, JSON.stringify(intent, null, 2));

    // Step 3: Route based on confidence
    // If intent.confidence === "low": run Agent 6, return { type: "needs_clarification", ... }
    console.log(`[Orchestrator:handleServiceRequest] Step 3: Evaluating confidence of parsed intent... confidence value:`, intent.confidence);
    if (intent.confidence === "low" || (typeof intent.confidence === 'number' && intent.confidence < 0.5)) {
      console.log(`[Orchestrator:handleServiceRequest] Step 3: Low confidence detected. Invoking ag6 (Clarification Agent)`);
      const ag6Input = {
        user_message: message,
        raw_text: message,
        userId: userId
      };

      console.log(`[Orchestrator:handleServiceRequest] Step 3: Invoking callClaude for 'ag6' with input:`, JSON.stringify(ag6Input, null, 2));

      const ag6Result = await callClaude(
        prompts.ag6(),
        prompts.inject(prompts.ag6User(), ag6Input),
        'ag6'
      );

      console.log(`[Orchestrator:handleServiceRequest] Step 3: ag6 result:`, JSON.stringify(ag6Result, null, 2));
      trace.push(ag6Result);

      const clarificationPrompt = ag6Result.output && ag6Result.output.clarification_prompt
        ? ag6Result.output.clarification_prompt
        : "Aapko kis qism ki service chahiye? Baraye meherbani wazahat karein.";

      console.log(`[Orchestrator:handleServiceRequest] Step 3: Low confidence clarification prompt selected: "${clarificationPrompt}"`);
      return {
        type: "needs_clarification",
        clarification: clarificationPrompt,
        clarification_prompt: clarificationPrompt,
        trace
      };
    }

    console.log(`[Orchestrator:handleServiceRequest] Step 3: High/medium confidence intent accepted. Proceeding to Provider Matching.`);

    // Step 4: Run Agent 2
    // Fetch all active providers from MongoDB: Provider.find({ active: true }).lean()
    console.log(`[Orchestrator:handleServiceRequest] Step 4: Querying MongoDB for active providers (active: true)...`);
    const activeProviders = await Provider.find({ active: true }).lean();
    console.log(`[Orchestrator:handleServiceRequest] Step 4: Found ${activeProviders.length} active providers in DB.`);

    // Extract dynamic metadata from the user request
    const service_type = intent.intent || "AC Repair";
    
    // Smart location extraction
    let location = "Karachi";
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("islamabad")) {
      location = "Islamabad";
    } else if (lowerMsg.includes("lahore")) {
      location = "Lahore";
    } else if (lowerMsg.includes("rawalpindi")) {
      location = "Rawalpindi";
    } else if (lowerMsg.includes("clifton")) {
      location = "Clifton, Karachi";
    } else if (lowerMsg.includes("gulshan")) {
      location = "Gulshan-e-Iqbal, Karachi";
    } else if (lowerMsg.includes("dha")) {
      location = "DHA, Karachi";
    }

    // Smart time_normalized extraction
    let time_normalized = "Today, 4:00 PM";
    if (lowerMsg.includes("urgent") || lowerMsg.includes("jaldi") || lowerMsg.includes("abhe") || lowerMsg.includes("now") || lowerMsg.includes("emergency")) {
      time_normalized = "Immediate";
    }

    // Smart urgency extraction
    let urgency = "medium";
    if (lowerMsg.includes("urgent") || lowerMsg.includes("jaldi") || lowerMsg.includes("abhe") || lowerMsg.includes("emergency") || lowerMsg.includes("fori")) {
      urgency = "high";
    }

    console.log(`[Orchestrator:handleServiceRequest] Step 4: Extracted info - Service Type: "${service_type}", Location: "${location}", Time Normalized: "${time_normalized}", Urgency: "${urgency}"`);

    // Inject: service_type, location, time_normalized, day_of_week, urgency, providers_json
    const ag2Input = {
      service_type,
      location,
      time_normalized,
      day_of_week: dayOfWeek,
      urgency,
      providers_json: JSON.stringify(activeProviders),
      // Also match the prompt structure if needed
      service: service_type,
      radius_km: 5.0
    };

    console.log(`[Orchestrator:handleServiceRequest] Step 4: Invoking callClaude for 'ag2' (Provider Matching)... Input:`, JSON.stringify(ag2Input, null, 2));

    const ag2Result = await callClaude(
      prompts.ag2(),
      prompts.inject(prompts.ag2User(), ag2Input),
      'ag2'
    );

    console.log(`[Orchestrator:handleServiceRequest] Step 4: ag2 result:`, JSON.stringify(ag2Result, null, 2));
    trace.push(ag2Result);

    const matchedCandidates = ag2Result.output
      ? (ag2Result.output.matched_candidates || ag2Result.output.matched_providers || [])
      : [];

    console.log(`[Orchestrator:handleServiceRequest] Step 4: ag2 returned matched candidates count: ${matchedCandidates.length}`);

    if (!ag2Result.success || matchedCandidates.length === 0) {
      console.warn(`[Orchestrator:handleServiceRequest] Step 4 Warning: No providers matched or ag2 call failed.`);
      return { type: "no_providers_found", trace };
    }

    // Fetch user preferences before calling AG3
    console.log(`[Orchestrator:handleServiceRequest] Step 5: Querying user preferences for userId: "${userId}"...`);
    let userPref = null;
    try {
      const prefQuery = Preference.findOne({ user_id: userId });
      if (prefQuery) {
        userPref = typeof prefQuery.lean === 'function' ? await prefQuery.lean() : await prefQuery;
        console.log(`[Orchestrator:handleServiceRequest] Step 5: User preference fetched:`, JSON.stringify(userPref, null, 2));
      } else {
        console.log(`[Orchestrator:handleServiceRequest] Step 5: No preference query generated.`);
      }
    } catch (err) {
      console.error(`[Orchestrator:handleServiceRequest] Step 5 Error: Failed to load user preferences:`, err.message);
      // Safe fallback
    }

    // Step 5: Run Agent 3
    // Inject: matched_providers_json, time_normalized, location, urgency, preferences_json
    const ag3Input = {
      matched_providers_json: JSON.stringify(matchedCandidates),
      time_normalized,
      location,
      urgency,
      preferences_json: userPref ? JSON.stringify(userPref) : "null",
      // And standard ag3 format
      candidates: matchedCandidates.map(c => c.provider_id || c.id),
      sorting_metrics: ["trust_score", "completed_jobs", "response_speed"]
    };

    console.log(`[Orchestrator:handleServiceRequest] Step 5: Invoking callClaude for 'ag3' (Provider Ranking)... Input:`, JSON.stringify(ag3Input, null, 2));

    const ag3Result = await callClaude(
      prompts.ag3(),
      prompts.inject(prompts.ag3User(), ag3Input),
      'ag3'
    );

    console.log(`[Orchestrator:handleServiceRequest] Step 5: ag3 result:`, JSON.stringify(ag3Result, null, 2));
    trace.push(ag3Result);

    let rankedList = [];
    if (ag3Result.output && ag3Result.output.ranked_list) {
      rankedList = ag3Result.output.ranked_list;
    } else if (ag3Result.output) {
      // Reconstruct from live LLM prompt structure: selected_provider, ranking_breakdown, and alternatives
      const selected = ag3Result.output.selected_provider || {};
      const breakdown = ag3Result.output.ranking_breakdown || [];
      const alternatives = ag3Result.output.alternatives || [];
      const explanation = ag3Result.output.decision_explanation || {};

      rankedList = matchedCandidates.map((candidate) => {
        const cId = String(candidate.provider_id || candidate.id || '');
        const cName = candidate.name || '';
        
        // Find matching entry by ID or name
        const isSelected = String(selected.id) === cId || String(selected.name).toLowerCase() === cName.toLowerCase();
        const details = breakdown.find(b => String(b.provider_name).toLowerCase() === cName.toLowerCase()) || {};
        const alt = alternatives.find(a => String(a.name).toLowerCase() === cName.toLowerCase()) || {};

        return {
          provider_id: cId,
          name: cName,
          trust_pts: details.trust_score_points || details.trust_pts || 85,
          slot_pts: details.slot_match_points || details.slot_pts || 90,
          price_pts: details.price_points || details.price_pts || 85,
          total_pts: details.total_score || details.total_pts || selected.total_score || alt.score || 260,
          ranking_index: isSelected ? 1 : 2,
          why_not_selected: alt.why_not_selected || (isSelected ? null : (explanation.roman_urdu || explanation.english || 'Not selected.'))
        };
      });

      // Sort by total_pts descending and re-assign ranking_index
      rankedList.sort((a, b) => (b.total_pts || 0) - (a.total_pts || 0));
      rankedList.forEach((item, idx) => {
        item.ranking_index = idx + 1;
      });
    } else {
      rankedList = matchedCandidates.map((c, idx) => ({
        provider_id: c.provider_id || c.id,
        name: c.name,
        trust_score: 90 - idx * 5,
        ranking_index: idx + 1
      }));
    }

    console.log(`[Orchestrator:handleServiceRequest] Step 5: Ranked List structure parsed:`, JSON.stringify(rankedList, null, 2));

    console.log(`[Orchestrator:handleServiceRequest] Step 5: Formatting and evaluating trust scores for final response...`);
    const matchedProviderIds = matchedCandidates.map(c => String(c.provider_id || c.id || c));
    const matchedDbProviders = activeProviders.filter(p => matchedProviderIds.includes(String(p._id)));

    const matched_providers = matchedDbProviders.map(p => {
      const scoring = rankedList.find(r => String(r.provider_id) === String(p._id)) || {};
      const computedScore = calculateTrustScore(p.rating, p.total_jobs_completed, p.cancellation_rate, p.avg_response_time_minutes);
      
      const mappedProvider = {
        id: p._id,
        name: p.name,
        trust_score: computedScore,
        rating: p.rating,
        jobs: p.total_jobs_completed,
        response_time: `${p.avg_response_time_minutes} mins`,
        service: p.service_types[0] || service_type,
        location: p.base_location.area || p.city,
        datetime: time_normalized,
        cost: p.price_range_pkr ? `Est. Rs. ${p.price_range_pkr.min} – ${p.price_range_pkr.max}` : 'Est. Rs. 2,000 – 4,500',
        trust_pts: scoring.trust_pts || scoring.trust_score_points || 85,
        slot_pts: scoring.slot_pts || scoring.slot_match_points || 90,
        price_pts: scoring.price_pts || scoring.price_points || 85,
        total_pts: scoring.total_pts || scoring.total_score || 260,
        why_not_selected: scoring.why_not_selected || p.why_not_selected,
      };

      console.log(`[Orchestrator:handleServiceRequest] Mapped Provider: "${mappedProvider.name}" (computedTrustScore: ${computedScore}, rating: ${p.rating}, jobs completed: ${p.total_jobs_completed})`);
      return mappedProvider;
    });

    const topRanked = rankedList.sort((a, b) => (a.ranking_index || 99) - (b.ranking_index || 99))[0];
    const topProviderId = topRanked ? String(topRanked.provider_id) : null;
    console.log(`[Orchestrator:handleServiceRequest] Step 5: topProviderId determined as: "${topProviderId}"`);
    const bestCandidate = matched_providers.find(p => String(p.id) === topProviderId) || matched_providers[0];
    console.log(`[Orchestrator:handleServiceRequest] Step 5: bestCandidate selected:`, bestCandidate ? bestCandidate.name : "None");

    let explanationStr = bestCandidate
      ? `${bestCandidate.name} ko unke behtareen ${bestCandidate.trust_score}% Trust Score aur behtareen response time ki wajah se select kiya gaya hai.`
      : 'Sajid Ali ko select kiya gaya hai.';

    if (ag3Result.output && ag3Result.output.decision_explanation) {
      explanationStr = ag3Result.output.decision_explanation.roman_urdu || ag3Result.output.decision_explanation.english || explanationStr;
    }

    const decision = {
      provider_id: bestCandidate ? bestCandidate.id : 'PRV001',
      decision_explanation: explanationStr,
    };

    const finalResponse = {
      type: "awaiting_confirmation",
      intent: service_type,
      matched_providers,
      decision,
      trace
    };

    console.log(`[Orchestrator:handleServiceRequest] === SUCCESS === Final Response Payload:`, JSON.stringify(finalResponse, null, 2));
    return finalResponse;

  } catch (err) {
    console.error('[Orchestrator:handleServiceRequest] === FAILURE === Pipeline Execution failure:', err);
    throw err;
  }
};

const executeBooking = async (decision, intent, userId = 'user_123') => {
  console.log(`[Orchestrator:executeBooking] === START ===`);
  console.log(`[Orchestrator:executeBooking] Inputs -> decision:`, JSON.stringify(decision, null, 2), `intent: "${intent}", userId: "${userId}"`);

  const trace = [];
  try {
    let provider = null;
    console.log(`[Orchestrator:executeBooking] Searching for provider by ID: "${decision.provider_id}"...`);
    try {
      provider = await Provider.findById(decision.provider_id);
      if (provider) {
        console.log(`[Orchestrator:executeBooking] Provider successfully found by ID: "${provider.name}"`);
      } else {
        console.log(`[Orchestrator:executeBooking] Provider NOT found by ID: "${decision.provider_id}"`);
      }
    } catch (e) {
      console.warn(`[Orchestrator:executeBooking] Warning: Invalid ObjectId queried. Fallback candidate search initiated. Error:`, e.message);
    }
    if (!provider) {
      console.log(`[Orchestrator:executeBooking] Fallback active provider lookup starting...`);
      provider = await Provider.findOne({ active: true });
      if (provider) {
        console.log(`[Orchestrator:executeBooking] Fallback active provider found: "${provider.name}"`);
      }
    }
    if (!provider) {
      console.error(`[Orchestrator:executeBooking] Error: Absolutely no active provider exists in DB.`);
      throw new Error(`Provider ${decision.provider_id} not found in system databases`);
    }

    const bookingId = `BK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const priceEst = provider.price_range_pkr ? provider.price_range_pkr.min : 2000;
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    
    const slotsForDay = provider.available_slots && provider.available_slots[dayOfWeek] ? provider.available_slots[dayOfWeek] : [];
    console.log(`[Orchestrator:executeBooking] slotsForDay list on day "${dayOfWeek}":`, slotsForDay);
    const slotToPull = slotsForDay.includes('4:00 PM') ? '4:00 PM' : (slotsForDay[0] || '4:00 PM');
    const confirmedTime = slotToPull || 'Today, 4:00 PM';

    console.log(`[Orchestrator:executeBooking] Booking parameters prepared -> bookingId: "${bookingId}", priceEst: ${priceEst}, dayOfWeek: "${dayOfWeek}", slotToPull: "${slotToPull}", confirmedTime: "${confirmedTime}"`);

    // Step 1: Run Agent 4
    // Inject all booking fields
    const ag4Input = {
      booking_id: bookingId,
      user_id: userId,
      provider_id: provider._id,
      provider_name: provider.name,
      service: intent || provider.service_types[0] || 'AC Repair',
      location: provider.base_location ? `${provider.base_location.area}, ${provider.city}` : provider.city,
      scheduled_datetime: confirmedTime,
      estimated_duration_hours: 2,
      estimated_price_pkr: priceEst,
      payment_method: 'cash_on_delivery',
      status: 'confirmed',
      preferred_slot: confirmedTime,
      calendar_sync: "active"
    };

    console.log(`[Orchestrator:executeBooking] Step 1: Invoking callClaude for 'ag4' (Booking Dispatcher)... Input:`, JSON.stringify(ag4Input, null, 2));

    const ag4Result = await callClaude(
      prompts.ag4(),
      prompts.inject(prompts.ag4User(), ag4Input),
      'ag4'
    );
    console.log(`[Orchestrator:executeBooking] Step 1: ag4 result:`, JSON.stringify(ag4Result, null, 2));
    trace.push(ag4Result);

    const actualConfirmedTime = ag4Result.output
      ? (ag4Result.output.confirmed_time || (ag4Result.output.booking_record && ag4Result.output.booking_record.scheduled_datetime) || confirmedTime)
      : confirmedTime;
    console.log(`[Orchestrator:executeBooking] confirmed time dynamically set to: "${actualConfirmedTime}"`);

    console.log(`[Orchestrator:executeBooking] Creating booking entry in MongoDB...`);
    // Save booking to MongoDB (Booking.create)
    const newBooking = await Booking.create({
      booking_id: bookingId,
      user_id: userId,
      provider_id: provider._id,
      provider_name: provider.name,
      service: intent || provider.service_types[0] || 'AC Repair',
      location: provider.base_location ? `${provider.base_location.area}, ${provider.city}` : provider.city,
      scheduled_datetime: actualConfirmedTime,
      estimated_duration_hours: 2,
      estimated_price_pkr: priceEst,
      payment_method: 'cash_on_delivery',
      status: 'confirmed',
      confirmation_messages: {
        english: (ag4Result.output && ag4Result.output.user_confirmation_message && ag4Result.output.user_confirmation_message.english) || `Awesome! Your booking with ${provider.name} is confirmed for ${actualConfirmedTime}. Estimated cost is Rs. ${priceEst}.`,
        roman_urdu: (ag4Result.output && ag4Result.output.user_confirmation_message && ag4Result.output.user_confirmation_message.roman_urdu) || `Shabash! Aapki booking ${provider.name} ke sath confirmed ho chuki hai. Estimated cost Rs. ${priceEst} hai.`
      },
      system_state_change: (ag4Result.output && ag4Result.output.system_state_change) || {
        before: 'searching_provider',
        after: 'provider_confirmed_scheduled'
      },
      simulated_actions: (ag4Result.output && ag4Result.output.simulated_actions_executed) || [
        'SMS Notification Sent to Provider & Customer',
        'WhatsApp Notification Confirmed via Twilio Sandbox',
        'Technician Scheduled in Active Dispatch Roster'
      ],
      agent_trace: trace
    });
    console.log(`[Orchestrator:executeBooking] Booking created. MongoDB ID = "${newBooking._id}"`);

    // Learn and update user preferences from this booking
    console.log(`[Orchestrator:executeBooking] Updating user preferences with new booking data...`);
    try {
      const { updatePreferences } = require('../helpers/preferences');
      await updatePreferences(userId, newBooking);
      console.log(`[Orchestrator:executeBooking] User preferences successfully updated.`);
    } catch (prefErr) {
      console.error('[Orchestrator:executeBooking] Failed to learn user preference history:', prefErr.message);
    }

    // Remove booked slot from provider (Provider.updateOne with $pull)
    console.log(`[Orchestrator:executeBooking] Pulling booked slot "${slotToPull}" from provider "${provider.name}" available slots...`);
    const pullUpdate = {};
    pullUpdate[`available_slots.${dayOfWeek}`] = slotToPull;
    const pullResult = await Provider.updateOne({ _id: provider._id }, { $pull: pullUpdate });
    console.log(`[Orchestrator:executeBooking] Provider slots update response:`, JSON.stringify(pullResult, null, 2));

    // Step 2: Run Agent 5
    // Check if first booking
    console.log(`[Orchestrator:executeBooking] Step 2: Determining if this is the first booking...`);
    const count = await Booking.countDocuments({ user_id: userId });
    const is_first_booking = count <= 1;
    console.log(`[Orchestrator:executeBooking] Step 2: User booking count is: ${count}. is_first_booking: ${is_first_booking}`);

    // Inject: booking_json, scheduled_datetime, language_detected, is_first_booking
    const ag5Input = {
      booking_json: JSON.stringify(newBooking),
      scheduled_datetime: actualConfirmedTime,
      language_detected: 'roman_urdu',
      is_first_booking
    };

    console.log(`[Orchestrator:executeBooking] Step 2: Invoking callClaude for 'ag5' (Follow-up generator)... Input:`, JSON.stringify(ag5Input, null, 2));

    const ag5Result = await callClaude(
      prompts.ag5(),
      prompts.inject(prompts.ag5User(), ag5Input),
      'ag5'
    );
    console.log(`[Orchestrator:executeBooking] Step 2: ag5 result:`, JSON.stringify(ag5Result, null, 2));
    trace.push(ag5Result);

    // Save the finalized trace to the booking document
    console.log(`[Orchestrator:executeBooking] Saving finalized agent trace back to booking document...`);
    const traceUpdateResult = await Booking.updateOne({ booking_id: bookingId }, { $set: { agent_trace: trace } });
    console.log(`[Orchestrator:executeBooking] Trace update DB result:`, JSON.stringify(traceUpdateResult, null, 2));

    // Determine follow-ups
    console.log(`[Orchestrator:executeBooking] Formatting and mapping follow-up steps...`);
    let followUps = [];
    if (ag5Result.output && (ag5Result.output.follow_up_schedule || ag5Result.output.follow_ups)) {
      const rawFollowUps = ag5Result.output.follow_up_schedule || ag5Result.output.follow_ups;
      console.log(`[Orchestrator:executeBooking] Using ag5-generated follow-ups:`, JSON.stringify(rawFollowUps, null, 2));
      followUps = rawFollowUps.map(f => {
        let channelIcon = f.channel || 'notifications-outline';
        const lowerChannel = String(channelIcon).toLowerCase();
        if (lowerChannel.includes('push') || lowerChannel.includes('notify')) {
          channelIcon = 'notifications-outline';
        } else if (lowerChannel.includes('sms') || lowerChannel.includes('phone') || lowerChannel.includes('mobile')) {
          channelIcon = 'phone-portrait-outline';
        } else if (lowerChannel.includes('whatsapp')) {
          channelIcon = 'logo-whatsapp';
        } else if (lowerChannel.includes('email') || lowerChannel.includes('mail')) {
          channelIcon = 'mail-outline';
        }
        return {
          booking_id: bookingId,
          user_id: userId,
          step: f.step || 1,
          trigger_label: f.trigger_label || 'Update',
          trigger_datetime: f.trigger_datetime || 'Pending',
          type: f.type || 'status_update',
          channel: channelIcon,
          message: f.message || '',
          action_button: f.action_button || null
        };
      });
    } else {
      console.log(`[Orchestrator:executeBooking] No ag5 follow-ups returned. Using fallback default follow-ups list.`);
      followUps = [
        {
          booking_id: bookingId,
          user_id: userId,
          step: 1,
          trigger_label: 'Booking Confirmed',
          trigger_datetime: 'Just now',
          type: 'status_update',
          channel: 'notifications-outline',
          message: `${provider.name} has accepted the booking request and started preparation.`
        },
        {
          booking_id: bookingId,
          user_id: userId,
          step: 2,
          trigger_label: 'Technician Leaves Location',
          trigger_datetime: 'In 3 hours',
          type: 'dispatch_alert',
          channel: 'phone-portrait-outline',
          message: `Technician leaves base coordinates & starts travel to ${provider.city}.`
        },
        {
          booking_id: bookingId,
          user_id: userId,
          step: 3,
          trigger_label: 'Arrival Verification PIN',
          trigger_datetime: actualConfirmedTime,
          type: 'final_verification',
          channel: 'logo-whatsapp',
          message: 'Provide arrival PIN to verification agent upon provider doorstep arrival.'
        }
      ];
    }

    // Save follow-ups to MongoDB (Followup.insertMany)
    console.log(`[Orchestrator:executeBooking] Inserting follow-up records to MongoDB:`, JSON.stringify(followUps, null, 2));
    const insertResult = await Followup.insertMany(followUps);
    console.log(`[Orchestrator:executeBooking] Follow-ups successfully saved. Inserted Count: ${insertResult.length}`);

    console.log("TRACE FINAL : ", trace);
    
    const finalBookingResult = {
      type: "booking_confirmed",
      booking_id: bookingId,
      confirmation: newBooking.confirmation_messages,
      state_change: newBooking.system_state_change,
      follow_up: followUps,
      trace
    };

    console.log(`[Orchestrator:executeBooking] === SUCCESS === Final booking response:`, JSON.stringify(finalBookingResult, null, 2));
    // Step 3: Return confirmation
    return finalBookingResult;

  } catch (err) {
    console.error('[Orchestrator:executeBooking] === FAILURE === Execute Booking error:', err);
    throw err;
  }
};

const getStateChangeDemo = async (bookingId) => {
  console.log(`[Orchestrator:getStateChangeDemo] === START === for bookingId: "${bookingId}"`);
  // 1. Find the booking
  const booking = await Booking.findOne({ booking_id: bookingId });
  if (!booking) {
    console.warn(`[Orchestrator:getStateChangeDemo] Booking record NOT found in DB for ID: "${bookingId}"`);
    return null;
  }
  console.log(`[Orchestrator:getStateChangeDemo] Booking record retrieved successfully:`, JSON.stringify(booking, null, 2));

  // 2. Find current provider state (this is "after")
  const providerAfter = await Provider.findById(booking.provider_id).lean();
  if (!providerAfter) {
    console.warn(`[Orchestrator:getStateChangeDemo] Provider "${booking.provider_id}" NOT found in DB.`);
    return null;
  }
  console.log(`[Orchestrator:getStateChangeDemo] Current provider state (AFTER) retrieved:`, JSON.stringify(providerAfter, null, 2));

  // Helper to extract day name
  const getDayName = (datetimeStr) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const lower = datetimeStr.toLowerCase();
    for (const day of days) {
      if (lower.includes(day)) return day;
    }
    const date = booking.created_at ? new Date(booking.created_at) : new Date();
    return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  };

  // Helper to extract clean slot
  const getBookedSlot = (datetimeStr) => {
    const slotParts = datetimeStr.split(" ");
    const rawSlot = slotParts.length > 1 ? slotParts[1] : slotParts[0];
    return rawSlot ? rawSlot.replace(',', '').slice(0, 5) : '4:00 PM';
  };

  // 3. Reconstruct "before" by adding the booked slot back
  const bookedSlot = getBookedSlot(booking.scheduled_datetime);
  const bookedDay = getDayName(booking.scheduled_datetime);
  console.log(`[Orchestrator:getStateChangeDemo] Reconstructed Booked Slot: "${bookedSlot}" on "${bookedDay}"`);
  
  const providerBefore = JSON.parse(JSON.stringify(providerAfter));

  // Initialize available_slots if undefined or empty
  if (!providerBefore.available_slots) {
    providerBefore.available_slots = {};
  }
  if (!providerBefore.available_slots[bookedDay]) {
    providerBefore.available_slots[bookedDay] = [];
  }

  // Push back slot if it is not already there (avoid duplicates)
  if (!providerBefore.available_slots[bookedDay].includes(bookedSlot)) {
    providerBefore.available_slots[bookedDay].push(bookedSlot);
    providerBefore.available_slots[bookedDay].sort();
    console.log(`[Orchestrator:getStateChangeDemo] Reconstructed available slots (BEFORE state) for day "${bookedDay}":`, providerBefore.available_slots[bookedDay]);
  }

  const stateComparisonResult = {
    before: {
      description: `${providerAfter.name} — BEFORE booking`,
      available_slots_for_day: providerBefore.available_slots[bookedDay],
      total_slots_that_day: providerBefore.available_slots[bookedDay].length
    },
    after: {
      description: `${providerAfter.name} — AFTER booking`,
      available_slots_for_day: providerAfter.available_slots ? (providerAfter.available_slots[bookedDay] || []) : [],
      total_slots_that_day: providerAfter.available_slots && providerAfter.available_slots[bookedDay] ? providerAfter.available_slots[bookedDay].length : 0
    },
    simulated_actions: booking.simulated_actions
  };

  console.log(`[Orchestrator:getStateChangeDemo] === SUCCESS === Returning comparison:`, JSON.stringify(stateComparisonResult, null, 2));
  return stateComparisonResult;
};

module.exports = {
  handleServiceRequest,
  executeBooking,
  getStateChangeDemo,
};
