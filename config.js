// Validate required environment variables on startup
const requiredEnvVars = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  MONGODB_URI: process.env.MONGODB_URI
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`${key} is required`);
  }
}

// Mask ANTHROPIC_API_KEY except the last 4 characters
const rawKey = process.env.ANTHROPIC_API_KEY || '';
const maskedKey = rawKey.length > 4 
  ? '*'.repeat(rawKey.length - 4) + rawKey.slice(-4)
  : '****';

const config = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
  maskedApiKey: maskedKey
};

console.log('--- Startup Configuration ---');
console.log(`Port: ${config.port}`);
console.log(`MongoDB URI: ${config.mongodbUri}`);
console.log(`Anthropic API Key: ${config.maskedApiKey}`);
console.log(`Node Env: ${config.nodeEnv}`);
console.log(`Allowed Origins: ${JSON.stringify(config.allowedOrigins)}`);
console.log('-----------------------------');

module.exports = config;
