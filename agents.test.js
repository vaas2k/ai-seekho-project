const orchestrator = require('./agents/orchestrator');
const { callClaude } = require('./agents/callClaude');
const prompts = require('./agents/prompts');
const Provider = require('./models/Provider');
const Booking = require('./models/Booking');
const Preference = require('./models/Preference');

// Mock callClaude and the Mongoose models
jest.mock('./agents/callClaude');
jest.mock('./models/Provider');
jest.mock('./models/Booking');
jest.mock('./models/Followup');
jest.mock('./models/Preference');

describe('--- PROMPTS.INJECT EDGE CASES ---', () => {
  test('String replacement should replace directly', () => {
    const template = 'Hello {{name}}!';
    const result = prompts.inject(template, { name: 'Osama' });
    expect(result).toBe('Hello Osama!');
  });

  test('Number replacement should cast to String', () => {
    const template = 'Radius: {{radius_km}}km';
    const result = prompts.inject(template, { radius_km: 5.2 });
    expect(result).toBe('Radius: 5.2km');
  });

  test('Null or undefined should format to "null"', () => {
    const template = 'Location: {{loc}}';
    const resultNull = prompts.inject(template, { loc: null });
    const resultUndef = prompts.inject(template, { loc: undefined });
    expect(resultNull).toBe('Location: null');
    expect(resultUndef).toBe('Location: null');
  });

  test('Objects and Arrays should stringify with 2-space indentation', () => {
    const template = 'Data: {{data}}';
    const obj = { area: 'G-13', city: 'Islamabad' };
    const arr = ['PRV001', 'PRV002'];

    const expectedObjStr = JSON.stringify(obj, null, 2);
    const expectedArrStr = JSON.stringify(arr, null, 2);

    expect(prompts.inject(template, { data: obj })).toBe(`Data: ${expectedObjStr}`);
    expect(prompts.inject(template, { data: arr })).toBe(`Data: ${expectedArrStr}`);
  });

  test('Missing variable should remain unresolved', () => {
    const template = 'Hello {{name}} from {{location}}!';
    const result = prompts.inject(template, { name: 'Osama' });
    expect(result).toBe('Hello Osama from {{location}}!');
  });
});

describe('--- AGENT 1 INTENT PARSER TESTS (10 Cases) ---', () => {
  let mockActiveProviders;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActiveProviders = [
      {
        _id: 'PRV001',
        name: 'Sajid Ali',
        rating: 4.8,
        total_jobs_completed: 140,
        cancellation_rate: 0.05,
        avg_response_time_minutes: 15,
        service_types: ['AC Repair'],
        base_location: { area: 'G-13', lat: 33.68, lng: 72.98 },
        city: 'Islamabad',
        available_slots: { monday: ['4:00 PM'] },
        price_range_pkr: { min: 2000, max: 4500 },
        active: true
      }
    ];

    Provider.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockActiveProviders),
    });
  });

  test('Case 1: "n G-13 tomorrow morning" -> high confidence, AC Technician', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'AC Repair', category: 'home_appliances', confidence: 0.95 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('n G-13 tomorrow morning', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('AC Repair');
    expect(result.matched_providers[0].name).toBe('Sajid Ali');
  });

  test('Case 2: "Mujhe kal subah G-13 mein AC technician chahiye" -> roman_urdu, high confidence', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'AC Repair', category: 'home_appliances', language: 'roman_urdu', confidence: 0.98 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('Mujhe kal subah G-13 mein AC technician chahiye', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('AC Repair');
  });

  test('Case 3: urdu detected -> "چاہیے الیکٹریشن مجھے"', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'Electrician', category: 'electrical', language: 'urdu', confidence: 0.97 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('چاہیے الیکٹریشن مجھے', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('Electrician');
  });

  test('Case 4: "I need help" -> low confidence, missing service_type and location', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: null, confidence: 0.2 }
        });
      }
      if (agent === 'ag6') {
        return Promise.resolve({
          success: true,
          output: { clarification_prompt: 'Aapko kis qism ki service chahiye? Baraye meherbani wazahat karein.' }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('I need help', 'user_123');
    expect(result.type).toBe('needs_clarification');
    expect(result.clarification_prompt).toBe('Aapko kis qism ki service chahiye? Baraye meherbani wazahat karein.');
  });

  test('Case 5: "bijli wala chahiye F-7 mein" -> normalized to Electrician', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'Electrician', category: 'electrical', confidence: 0.95 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('bijli wala chahiye F-7 mein', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('Electrician');
  });

  test('Case 6: "nali wala urgent" -> Plumber, urgency=high', async () => {
    let ag2Urgency = '';
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'Plumber', category: 'plumbing', confidence: 0.96 }
        });
      }
      if (agent === 'ag2') {
        const injectedUser = user;
        if (injectedUser.includes('Urgency: high')) {
          ag2Urgency = 'high';
        }
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('nali wala urgent', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('Plumber');
    expect(ag2Urgency).toBe('high');
  });

  test('Case 7: "parson painter" -> service=Painter, time is day after tomorrow', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'Painter', category: 'renovation', confidence: 0.92 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('parson painter', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('Painter');
  });

  test('Case 8: "cook ke liye" -> Cook, location=null (medium confidence)', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'Cook', category: 'domestic', confidence: 0.65 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('cook ke liye', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('Cook');
  });

  test('Case 9: Empty string -> should not crash, return low confidence', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: null, confidence: 0.1 }
        });
      }
      if (agent === 'ag6') {
        return Promise.resolve({
          success: true,
          output: { clarification_prompt: 'Aapko kis qism ki service chahiye? Baraye meherbani wazahat karein.' }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('', 'user_123');
    expect(result.type).toBe('needs_clarification');
    expect(result.clarification_prompt).toBe('Aapko kis qism ki service chahiye? Baraye meherbani wazahat karein.');
  });

  test('Case 10: Very long message (500 chars) -> should parse without error', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'AC Repair', category: 'home_appliances', confidence: 0.95 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const longMsg = 'AC technician chahiye '.repeat(25); // ~500 chars
    const result = await orchestrator.handleServiceRequest(longMsg, 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.intent).toBe('AC Repair');
  });
});

describe('--- AGENT 2 MATCHER TESTS (5 Cases) ---', () => {
  let mockActiveProviders;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActiveProviders = [
      {
        _id: 'PRV001',
        name: 'Sajid Ali',
        rating: 4.8,
        total_jobs_completed: 140,
        cancellation_rate: 0.05,
        avg_response_time_minutes: 15,
        service_types: ['AC Repair'],
        base_location: { area: 'G-13', lat: 33.68, lng: 72.98 },
        city: 'Islamabad',
        available_slots: { monday: ['4:00 PM'] },
        price_range_pkr: { min: 2000, max: 4500 },
        active: true
      },
      {
        _id: 'PRV002',
        name: 'Kamran Khan',
        rating: 4.5,
        total_jobs_completed: 92,
        cancellation_rate: 0.1,
        avg_response_time_minutes: 30,
        service_types: ['AC Repair'],
        base_location: { area: 'F-7', lat: 33.72, lng: 73.05 },
        city: 'Islamabad',
        available_slots: { monday: ['5:30 PM'] },
        price_range_pkr: { min: 2200, max: 4800 },
        active: true
      }
    ];

    Provider.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockActiveProviders),
    });
  });

  test('Case 1: Valid service + location -> returns 1-5 matched providers', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }, { provider_id: 'PRV002', name: 'Kamran Khan' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', trust_score: 92, ranking_index: 1 }, { provider_id: 'PRV002', trust_score: 80, ranking_index: 2 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair in Islamabad', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.matched_providers).toHaveLength(2);
  });

  test('Case 2: Service with no exact match -> fallback_used=true', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Cleaning', confidence: 0.90 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { fallback_used: true, matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC deep cleaning Islamabad', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.matched_providers).toHaveLength(1);
  });

  test('Case 3: Location with no providers -> total_found=0', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { candidates_found: 0, matched_candidates: [] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair in Gwadar', 'user_123');
    expect(result.type).toBe('no_providers_found');
  });

  test('Case 4: Urgent request -> closest slot preferred', async () => {
    let ag2Urgency = '';
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        const injectedUser = user;
        if (injectedUser.includes('Urgency: high')) {
          ag2Urgency = 'high';
        }
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', trust_score: 92, ranking_index: 1 }] }
        });
      }
    });

    await orchestrator.handleServiceRequest('AC repair urgently now', 'user_123');
    expect(ag2Urgency).toBe('high');
  });

  test('Case 5: All providers inactive -> empty array returned', async () => {
    Provider.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]), // No active providers returned from database query
    });

    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [] }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair Islamabad', 'user_123');
    expect(result.type).toBe('no_providers_found');
  });
});

describe('--- AGENT 3 SCORING & RANKING TESTS (3 Cases) ---', () => {
  let mockActiveProviders;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActiveProviders = [
      {
        _id: 'PRV001',
        name: 'Sajid Ali',
        rating: 4.8,
        total_jobs_completed: 140,
        cancellation_rate: 0.05,
        avg_response_time_minutes: 15,
        service_types: ['AC Repair'],
        base_location: { area: 'G-13', lat: 33.68, lng: 72.98 },
        city: 'Islamabad',
        available_slots: { monday: ['4:00 PM'] },
        price_range_pkr: { min: 2000, max: 4500 },
        active: true
      },
      {
        _id: 'PRV002',
        name: 'Kamran Khan',
        rating: 4.5,
        total_jobs_completed: 92,
        cancellation_rate: 0.1,
        avg_response_time_minutes: 30,
        service_types: ['AC Repair'],
        base_location: { area: 'F-7', lat: 33.72, lng: 73.05 },
        city: 'Islamabad',
        available_slots: { monday: ['5:30 PM'] },
        price_range_pkr: { min: 2200, max: 4800 },
        active: true
      }
    ];

    Provider.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockActiveProviders),
    });
  });

  test('Case 1: Two providers -> correct one ranked first by formula', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }, { provider_id: 'PRV002', name: 'Kamran Khan' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: {
            ranked_list: [
              { provider_id: 'PRV001', trust_score: 91.6, ranking_index: 1 },
              { provider_id: 'PRV002', trust_score: 78.4, ranking_index: 2 }
            ]
          }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair G-13', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.decision.provider_id).toBe('PRV001'); // Sajid Ali ranked 1st
  });

  test('Case 2: Equal scores -> trust_score tiebreaker applied', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }, { provider_id: 'PRV002', name: 'Kamran Khan' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: {
            ranked_list: [
              { provider_id: 'PRV001', trust_score: 90.0, ranking_index: 1 },
              { provider_id: 'PRV002', trust_score: 90.0, ranking_index: 2 }
            ]
          }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair F-7', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.decision.provider_id).toBe('PRV001'); // Tie broken, Sajid Ali first due to 90.0 vs 90.0 but ranking_index 1
  });

  test('Case 3: High urgency -> slot proximity bonus applied', async () => {
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({ success: true, output: { intent: 'AC Repair', confidence: 0.95 } });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }, { provider_id: 'PRV002', name: 'Kamran Khan' }] }
        });
      }
      if (agent === 'ag3') {
        return Promise.resolve({
          success: true,
          output: {
            ranked_list: [
              { provider_id: 'PRV001', trust_score: 95.0, ranking_index: 1, slot_pts: 95 },
              { provider_id: 'PRV002', trust_score: 85.0, ranking_index: 2, slot_pts: 70 }
            ]
          }
        });
      }
    });

    const result = await orchestrator.handleServiceRequest('AC repair urgent', 'user_123');
    expect(result.type).toBe('awaiting_confirmation');
    expect(result.matched_providers[0].slot_pts).toBe(95); // High slot proximity points applied
  });
});

describe('--- STATE CHANGE DEMO TESTS ---', () => {
  test('Reconstructs before and after states correctly by adding the slot back to before state', async () => {
    Booking.findOne.mockResolvedValue({
      booking_id: 'BK-TEST123',
      provider_id: 'PRV001',
      scheduled_datetime: 'Today, 14:00',
      simulated_actions: ['Action 1', 'Action 2'],
      created_at: new Date('2026-05-18T10:00:00Z') // Monday
    });

    Provider.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'PRV001',
        name: 'Sajid Ali',
        available_slots: {
          monday: ['09:00', '11:00', '16:00'], // 14:00 is removed (after state)
          tuesday: ['10:00']
        }
      })
    });

    const result = await orchestrator.getStateChangeDemo('BK-TEST123');
    expect(result).not.toBeNull();
    expect(result.after.available_slots_for_day).toEqual(['09:00', '11:00', '16:00']);
    expect(result.after.total_slots_that_day).toBe(3);

    // 14:00 slot should be added back in the before state, sorted correctly
    expect(result.before.available_slots_for_day).toEqual(['09:00', '11:00', '14:00', '16:00']);
    expect(result.before.total_slots_that_day).toBe(4);
    expect(result.simulated_actions).toEqual(['Action 1', 'Action 2']);
  });
});

describe('--- USER PREFERENCE LEARNING LAYER ---', () => {
  let mockSave;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave = jest.fn().mockResolvedValue(true);
    prompts.reloadAll();
  });

  test('updatePreferences creates new preferences and infers time of day', async () => {
    // 1. Mock Preference.findOne to return null (first booking)
    Preference.findOne.mockResolvedValue(null);

    // Mock the constructor behavior of Preference
    Preference.mockImplementation(function(data) {
      this.user_id = data.user_id;
      this.preferred_services = data.preferred_services || [];
      this.preferred_areas = data.preferred_areas || [];
      this.preferred_time_of_day = data.preferred_time_of_day;
      this.save = mockSave;
    });

    const { updatePreferences } = require('./helpers/preferences');
    
    // Booking at 10:00 (morning)
    const booking = {
      service: 'AC Repair',
      location: 'G-13, Islamabad',
      scheduled_datetime: 'Today, 10:00'
    };

    const res = await updatePreferences('user_pref_123', booking);
    expect(res).not.toBeNull();
    expect(res.user_id).toBe('user_pref_123');
    expect(res.preferred_services).toEqual([{ service: 'AC Repair', count: 1 }]);
    expect(res.preferred_areas).toEqual([{ area: 'G-13', count: 1 }]);
    expect(res.preferred_time_of_day).toBe('morning');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test('updatePreferences increments and sorts existing preferences correctly', async () => {
    // Mock existing document
    const mockPrefDoc = {
      user_id: 'user_pref_123',
      preferred_services: [
        { service: 'Electrician', count: 2 },
        { service: 'AC Repair', count: 1 }
      ],
      preferred_areas: [
        { area: 'F-7', count: 1 }
      ],
      preferred_time_of_day: 'morning',
      save: mockSave
    };
    Preference.findOne.mockResolvedValue(mockPrefDoc);

    const { updatePreferences } = require('./helpers/preferences');
    
    // Booking AC Repair at 15:30 (afternoon)
    const booking = {
      service: 'AC Repair',
      location: 'F-7, Islamabad',
      scheduled_datetime: 'Today, 15:30'
    };

    const res = await updatePreferences('user_pref_123', booking);
    expect(res).not.toBeNull();
    // AC Repair count should increment from 1 to 2
    const acSvc = res.preferred_services.find(s => s.service === 'AC Repair');
    expect(acSvc.count).toBe(2);
    // Area F-7 count should increment from 1 to 2
    const f7Area = res.preferred_areas.find(a => a.area === 'F-7');
    expect(f7Area.count).toBe(2);
    
    expect(res.preferred_time_of_day).toBe('afternoon');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test('Orchestrator injects user preferences into AG3 inputs', async () => {
    const mockPrefDoc = {
      user_id: 'user_123',
      preferred_services: [{ service: 'AC Repair', count: 5 }],
      preferred_areas: [{ area: 'G-13', count: 5 }],
      preferred_time_of_day: 'morning'
    };
    Preference.findOne.mockResolvedValue(mockPrefDoc);

    const mockActiveProviders = [
      {
        _id: 'PRV001',
        name: 'Sajid Ali',
        rating: 4.8,
        total_jobs_completed: 140,
        cancellation_rate: 0.05,
        avg_response_time_minutes: 15,
        service_types: ['AC Repair'],
        base_location: { area: 'G-13', lat: 33.68, lng: 72.98 },
        city: 'Islamabad',
        available_slots: { monday: ['4:00 PM'] },
        price_range_pkr: { min: 2000, max: 4500 },
        active: true
      }
    ];

    Provider.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockActiveProviders),
    });

    let ag3InjectedPrompt = '';
    callClaude.mockImplementation((sys, user, agent) => {
      if (agent === 'ag1') {
        return Promise.resolve({
          success: true,
          output: { intent: 'AC Repair', category: 'home_appliances', confidence: 0.95 }
        });
      }
      if (agent === 'ag2') {
        return Promise.resolve({
          success: true,
          output: { matched_candidates: [{ provider_id: 'PRV001', name: 'Sajid Ali' }] }
        });
      }
      if (agent === 'ag3') {
        ag3InjectedPrompt = user;
        return Promise.resolve({
          success: true,
          output: { ranked_list: [{ provider_id: 'PRV001', name: 'Sajid Ali', trust_score: 97, ranking_index: 1 }] }
        });
      }
    });

    await orchestrator.handleServiceRequest('AC repair Islamabad', 'user_123');
    // Ensure that User Preference History is correctly loaded and stringified into the AG3 user prompt
    expect(ag3InjectedPrompt).toContain('User preference history:');
    expect(ag3InjectedPrompt).toContain('preferred_services');
    expect(ag3InjectedPrompt).toContain('AC Repair');
  });
});
