const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose with active connection monitoring.
 * @param {string} uri - The MongoDB connection URI
 */
const connect = async (uri) => {
  const connectionUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/hirefast_pk';

  // Mongoose connection event listeners
  mongoose.connection.on('connected', () => {
    const dbName = mongoose.connection.name;
    console.log(`Successfully connected to MongoDB database: "${dbName}"`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error occurred:', err.message);
    process.exit(1);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection has been disconnected.');
  });

  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (err) {
    console.error('Failed to establish initial MongoDB connection:', err.message);
    process.exit(1);
  }
};

module.exports = connect;
