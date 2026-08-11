require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { initSocket } = require('./socket');
const orderRoutes = require('./routes/orders');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

initSocket(server, app, allowedOrigins.length ? allowedOrigins : '*');

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Angaar Dhaba API is running' });
});

app.use('/api/orders', orderRoutes);

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});
