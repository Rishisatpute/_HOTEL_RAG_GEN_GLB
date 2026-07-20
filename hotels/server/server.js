require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { initSocket } = require('./socket');

const orderRoutes = require('./routes/orders');
const reservationRoutes = require('./routes/reservations');
const statsRoutes = require('./routes/stats');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

initSocket(server, app);

app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/orders', orderRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/stats', statsRoutes);

app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Savory Restaurant API is running' });
});

async function startServer() {
  console.log('[Server] Starting server...');
  console.log('[Server] Connecting to database...');
  await connectDB();

  console.log('[Server] Database connected, starting HTTP server on port', PORT);
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Menu:    http://localhost:${PORT}/restaurant-menu.html`);
    console.log(`Kitchen: http://localhost:${PORT}/kitchen-dashboard.html`);
    console.log(`Counter: http://localhost:${PORT}/counter-dashboard.html`);
    console.log(`Booking: http://localhost:${PORT}/booking.html`);
    console.log(`Admin:   http://localhost:${PORT}/admin-dashboard.html`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
