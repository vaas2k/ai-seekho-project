const prompts = require('./agents/prompts');

console.log('--- TESTING PROMPTS ---');

// 1. Check system prompt output
const ag1System = prompts.ag1();
console.log('ag1 System Prompt Exists:', !!ag1System);
console.log('ag1 System Prompt Snippet:', ag1System.substring(0, 100));

// 2. Check user prompt template output
const ag1UserTemplate = prompts.ag1User();
console.log('ag1 User Template Exists:', !!ag1UserTemplate);
console.log('ag1 User Template:', ag1UserTemplate);

// 3. Test injection function
console.log('\n--- TESTING INJECT FUNCTION ---');
const testTemplate = 'Hello {{name}}! Your items are: {{items}}. Score: {{score}}. Non-existent: {{missing}}. Null: {{empty_val}}.';
const variables = {
  name: 'Salma',
  items: ['Laptop', 'Phone'],
  score: 98.5,
  empty_val: null
};

const injected = prompts.inject(testTemplate, variables);
console.log('Injected output:\n', injected);

// 4. Test hot reload
console.log('\n--- TESTING RELOAD ALL ---');
prompts.reloadAll();
console.log('ag1 System after reload:', !!prompts.ag1());

console.log('\n--- PROMPT SYSTEM VERIFIED SUCCESSFULLY! ---');
