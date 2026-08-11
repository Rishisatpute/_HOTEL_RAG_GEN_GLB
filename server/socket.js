const { Server } = require('socket.io');

// Replaces BroadcastChannel: instead of pushing to other tabs in the same
// browser, this pushes to every connected browser (menu/kitchen/waiter/
// counter, on any device). One restaurant, so no rooms — everyone gets
// every event, exactly like the old same-browser version did.
function initSocket(httpServer, app, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PATCH'] }
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('[Socket] client connected', socket.id);
    socket.on('disconnect', () => console.log('[Socket] client disconnected', socket.id));
  });

  return io;
}

// Mirrors orders.js's emit(type, payload): one event name per order-store
// action, broadcast to everyone. OrderStore.onChange(fn) on the frontend
// wraps this back into the same { type, payload, at } shape it always used.
function emitEvent(app, type, payload) {
  const io = app.get('io');
  if (!io) return;
  io.emit(type, { payload, at: Date.now() });
}

module.exports = { initSocket, emitEvent };
