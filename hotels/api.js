/**
 * API helper — use the same origin when the site is served by Express (port 5000/3000).
 * Fall back to port 5000 when opened via Live Server or file preview.
 */
function resolveApiBase() {
  const { protocol, hostname, port, origin } = window.location;

  if (protocol !== 'http:' && protocol !== 'https:') {
    return 'http://localhost:5000';
  }

  if (port === '5000' || port === '3000') {
    return origin;
  }

  if (!port && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return origin;
  }

  return `${protocol}//${hostname}:5000`;
}

const API_BASE = window.API_BASE || resolveApiBase();
window.API_BASE = API_BASE;

const api = {
  async request(endpoint, options = {}) {
    console.log('[API] Request', endpoint, options);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const text = await response.text();
      let data;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[API] Invalid JSON response', text, parseError);
          throw new Error('Invalid JSON response from server');
        }
      } else {
        data = { success: response.ok };
      }
      console.log('[API] Response', endpoint, response.status, data);
      if (!response.ok) {
        throw new Error((data && data.message) || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error('[API] Fetch error', endpoint, error);
      const isNetwork =
        error instanceof TypeError ||
        (error.message && /failed to fetch|network|load failed/i.test(error.message));
      if (isNetwork) {
        throw new Error(
          `Cannot reach the server at ${API_BASE}. Start the backend (cd server → npm start), then open ${API_BASE}/booking.html in your browser — do not open the HTML file directly.`
        );
      }
      throw new Error(error.message || 'Network error occurred');
    }
  },

  getOrders(params = '') {
    return this.request(`/api/orders${params}`);
  },

  createOrder(orderData) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  updateOrderStatus(orderId, orderStatus) {
    return this.request(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ orderStatus })
    });
  },

  updatePayment(orderId, paymentMethod, paymentStatus, invoiceGenerated) {
    return this.request(`/api/orders/${orderId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentMethod, paymentStatus, invoiceGenerated })
    });
  },

  getCounterOrders() {
    return this.request('/api/orders?counter=true');
  },

  getReservations() {
    return this.request('/api/reservations');
  },

  createReservation(data) {
    return this.request('/api/reservations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getStats() {
    return this.request('/api/stats');
  }
};

window.api = api;
