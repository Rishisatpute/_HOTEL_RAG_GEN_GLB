/**
 * Socket.io client for real-time restaurant updates
 */
(function () {
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.8.0/socket.io.min.js';
  script.onload = () => {
    const origin = window.API_BASE || (() => {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return `http://${host}:5000`;
      }
      return 'http://localhost:5000';
    })();

    window.restaurantSocket = io(origin, { transports: ['websocket', 'polling'] });
    window.restaurantSocket.on('connect', () => {
      const room = document.body.dataset.socketRoom;
      if (room) window.restaurantSocket.emit('join', room);
    });
    window.restaurantSocket.on('connect_error', (err) => {
      console.warn('[Socket] connect_error', err);
    });
  };
  document.head.appendChild(script);
})();
