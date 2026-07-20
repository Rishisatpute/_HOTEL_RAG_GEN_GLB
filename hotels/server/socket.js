function initSocket(httpServer, app) {
  const { Server } = require('socket.io');
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    socket.join('kitchen');
    socket.join('counter');
    socket.join('admin');

    socket.on('join', (room) => {
      if (['kitchen', 'counter', 'admin'].includes(room)) {
        socket.join(room);
      }
    });
  });

  return io;
}

function emitOrderEvent(app, event, order) {
  const io = app.get('io');
  if (!io) return;
  io.to('kitchen').to('counter').to('admin').emit(event, order);
}

function emitReservationEvent(app, event, reservation) {
  const io = app.get('io');
  if (!io) return;
  io.to('counter').to('admin').emit(event, reservation);
}

module.exports = { initSocket, emitOrderEvent, emitReservationEvent };
