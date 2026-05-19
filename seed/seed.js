// Load env config first from root backend folder
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hirefast_pk';

const seedDatabase = async () => {
  try {
    console.log(`Connecting to MongoDB for seeding at: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('Database Connected Successfully.');

    // Drop the existing providers collection
    console.log('Dropping existing providers collection...');
    try {
      await Provider.collection.drop();
      console.log('Collection dropped.');
    } catch (dropErr) {
      if (dropErr.code === 26) {
        console.log('Collection does not exist. Skipping drop.');
      } else {
        console.error('Error dropping collection:', dropErr.message);
      }
    }

    // Read high-fidelity providers JSON
    const seedDataPath = path.join(__dirname, 'providers.json');
    if (!fs.existsSync(seedDataPath)) {
      throw new Error(`Seeding file not found at path: ${seedDataPath}`);
    }

    const providersData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

    // Insert all 20 providers
    console.log(`Inserting ${providersData.length} providers into DB...`);
    const insertRes = await Provider.insertMany(providersData);
    
    // Log count confirmation
    console.log(`Count confirmation: Successfully seeded exactly ${insertRes.length} providers!`);

    // Disconnect cleanly
    await mongoose.connection.close();
    console.log('MongoDB connection closed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding engine encountered error:', err);
    process.exit(1);
  }
};

seedDatabase();
