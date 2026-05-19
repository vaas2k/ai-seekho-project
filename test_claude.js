require('dotenv').config();
const { callClaude, callClaudeRaw } = require('./agents/callClaude');

async function run() {
  console.log("=========================================");
  console.log("   HireFast PK - callClaude.js Tester");
  console.log("=========================================");
  
  // 1. Check API Key configuration
  const apiKey = process.env.ANTHROPIC_API_KEY || 'mock-key';
  console.log(`Current API Key in .env: "${apiKey}"`);
  
  const isMockMode = !apiKey || apiKey.includes('mock') || apiKey === 'AIzaSyC-WXXynkztkQMlItseqhGvLh-gJHvZaGg';
  if (isMockMode) {
    console.log("🤖 Mode: OFFLINE MOCK FALLBACK (Bypassing external Anthropic API)");
  } else {
    console.log("⚡ Mode: LIVE ANTHROPIC CLAUDE API CONNECTED");
  }

  // 2. Test Cases for Agents
  const testAgents = ['ag1', 'ag2', 'ag3', 'ag4', 'ag5', 'ag6'];
  const testInputs = {
    ag1: { raw_text: "AC ki service karwani hai Islamabad me", userId: "user_123" },
    ag2: { service: "AC Repair", location: "Islamabad, Pakistan", radius_km: 5.0 },
    ag3: { candidates: ["PRV001", "PRV011"], sorting_metrics: ["trust_score"] },
    ag4: { preferred_slot: "Today, 4:00 PM", provider_id: "PRV001", calendar_sync: "active" },
    ag5: { provider_id: "PRV001", intent: "AC Repair", base_estimate: "Rs. 2,000 - 4,500" },
    ag6: { raw_text: "mujhe kuch chahiye", userId: "user_123" }
  };

  console.log("\n--- Starting test suite runs ---\n");

  for (const agent of testAgents) {
    console.log(`[Testing Agent: ${agent}]`);
    const systemPrompt = `Test System Prompt for ${agent}`;
    const userPrompt = JSON.stringify(testInputs[agent]);
    
    try {
      const result = await callClaude(systemPrompt, userPrompt, agent);
      console.log(`- Success Status: ${result.success}`);
      console.log(`- Execution duration: ${result.duration_ms}ms`);
      if (result.success) {
        console.log(`- Parsed Output:`, JSON.stringify(result.output, null, 2));
      } else {
        console.log(`- Error:`, result.error);
      }
    } catch (err) {
      console.error(`- Fatal crash testing ${agent}:`, err);
    }
    console.log("-----------------------------------------");
  }
}

run();
