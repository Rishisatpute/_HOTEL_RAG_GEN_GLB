const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env (local) or set it in your hosting platform\'s dashboard.');
  }

  console.log('[DB] Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('[DB] Connected');
}

module.exports = connectDB;
