// Load dotenv first
require('dotenv').config();

// Load and validate config
const config = require('./config');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const serviceRequestRoutes = require('./routes/serviceRequest');
const bookingsRoutes = require('./routes/bookings');
const providersRoutes = require('./routes/providers');
const connectDB = require('./db/connect');

const app = express();
const PORT = config.port;
const MONGO_URI = config.mongodbUri;
const allowedOrigins = config.allowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow request with no origin (like mobile apps, curl, postman)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Origin access blocked by CORS security'));
  }
}));

// Security & Parsing
app.use(helmet());
app.use(express.json());

// -------------------------------------------------------------
// Request Logging & X-Response-Time Header Injection
// -------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();

  // Intercept writeHead to calculate and inject the X-Response-Time header
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    originalWriteHead.apply(res, args);
  };

  // Log complete metadata on transaction completion
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Dev Morgan Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// -------------------------------------------------------------
// Rate Limiter Middlewares
// -------------------------------------------------------------
const serviceRequestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const confirmBookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Rate Limiters to Specific Endpoints
app.use('/api/service-request', serviceRequestLimiter);
app.use('/api/confirm-booking', confirmBookingLimiter);

// Database connection
connectDB(MONGO_URI);

// Register routes
app.use('/api', serviceRequestRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/providers', providersRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// -------------------------------------------------------------
// Production-quality Global Error Handler
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled System Error:', err);
    res.status(status).json({
      error: err.message || 'Internal Server Error',
      stack: err.stack,
    });
  } else {
    // Sanitized clean JSON for production security
    res.status(status).json({
      error: 'Kuch masla pesh aya. Internal Server Error.',
      code: status,
    });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`HireFast PK Backend running on port ${PORT}`);
});

// Graceful Shutdown
const shutdownGracefully = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));
