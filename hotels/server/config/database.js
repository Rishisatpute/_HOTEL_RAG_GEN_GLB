const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/savory_restaurant';

  console.log('[DB] Attempting to connect to MongoDB at', uri);
  try {
    // Add serverSelectionTimeoutMS to fail fast if MongoDB isn't running
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log('[DB] MongoDB connected successfully');
    return;
  } catch (error) {
    console.warn('[DB] Could not connect to MongoDB at', uri);
    console.warn('[DB] Error:', error.message);
    console.warn('[DB] Starting in-memory database (install MongoDB for persistent data)...');
  }

  try {
    console.log('[DB] Creating in-memory MongoDB server...');
    memoryServer = await MongoMemoryServer.create();
    console.log('[DB] In-memory MongoDB server created');
    const memUri = memoryServer.getUri('savory_restaurant');
    console.log('[DB] Connecting to in-memory MongoDB...');
    await mongoose.connect(memUri);
    console.log('[DB] In-memory MongoDB ready — data resets when server stops');
  } catch (error) {
    console.error('[DB] Database connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
