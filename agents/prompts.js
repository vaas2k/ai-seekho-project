const fs = require('fs');
const path = require('path');

// Memory Cache
let cache = null;

const promptFiles = {
  ag1: 'ag1_intent.txt',
  ag2: 'ag2_matcher.txt',
  ag3: 'ag3_ranking.txt',
  ag4: 'ag4_booking.txt',
  ag5: 'ag5_followup.txt',
  ag6: 'ag6_clarify.txt'
};

const loadAndParsePrompts = () => {
  const loaded = {};
  for (const [key, filename] of Object.entries(promptFiles)) {
    try {
      const fullPath = path.join(__dirname, '../prompts', filename);
      const content = fs.readFileSync(fullPath, 'utf8');
      const parts = content.split('---');
      
      const systemPrompt = parts[0] ? parts[0].trim() : '';
      const userTemplate = parts[1] ? parts[1].trim() : '';
      
      loaded[key] = {
        system: systemPrompt,
        user: userTemplate
      };
    } catch (err) {
      console.error(`Failed to load and parse prompt file ${filename}:`, err.message);
      loaded[key] = {
        system: '',
        user: ''
      };
    }
  }
  return loaded;
};

const ensureCache = () => {
  if (!cache) {
    cache = loadAndParsePrompts();
  }
};

const getSystemPrompt = (key) => {
  ensureCache();
  return cache[key] ? cache[key].system : '';
};

const getUserTemplate = (key) => {
  ensureCache();
  return cache[key] ? cache[key].user : '';
};

// Expose: inject(template, variables)
const inject = (template, variables) => {
  if (!template) return '';
  if (!variables) return template;
  
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!(key in variables)) {
      return match; // Keep unresolved variables
    }
    const val = variables[key];
    if (val === null || val === undefined) {
      return 'null';
    }
    if (Array.isArray(val) || typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    if (typeof val === 'number') {
      return String(val);
    }
    return String(val); // Strings, Booleans, etc.
  });
};

const reloadAll = () => {
  cache = loadAndParsePrompts();
  console.log('Cleared prompts cache and reloaded all prompts from disk.');
};

module.exports = {
  // System prompts
  ag1: () => getSystemPrompt('ag1'),
  ag2: () => getSystemPrompt('ag2'),
  ag3: () => getSystemPrompt('ag3'),
  ag4: () => getSystemPrompt('ag4'),
  ag5: () => getSystemPrompt('ag5'),
  ag6: () => getSystemPrompt('ag6'),
  
  // User templates
  ag1User: () => getUserTemplate('ag1'),
  ag2User: () => getUserTemplate('ag2'),
  ag3User: () => getUserTemplate('ag3'),
  ag4User: () => getUserTemplate('ag4'),
  ag5User: () => getUserTemplate('ag5'),
  ag6User: () => getUserTemplate('ag6'),
  
  // Helpers
  inject,
  reloadAll
};
