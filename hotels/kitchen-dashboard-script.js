/**
 * Kitchen Display — Real-time order management
 */
class KitchenDashboard {
  constructor() {
    this.orders = [];
    this.filter = 'all';
    this.init();
  }

  init() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadOrders());

    document.querySelectorAll('.status-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.status-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.filter = tab.dataset.filter;
        this.renderOrders();
      });
    });

    this.loadOrders();
    this.setupSocket();
  }

  setupSocket() {
    const connect = () => {
      if (!window.restaurantSocket) {
        setTimeout(connect, 500);
        return;
      }
      window.restaurantSocket.emit('join', 'kitchen');
      window.restaurantSocket.on('order:new', (order) => {
        this.orders.unshift(order);
        this.renderOrders();
        this.playAlert();
        this.showToast(`New order ${order.orderId} — Table ${order.tableNumber}`);
      });
      window.restaurantSocket.on('order:updated', (order) => {
        const idx = this.orders.findIndex((o) => o.orderId === order.orderId);
        if (idx >= 0) this.orders[idx] = order;
        else this.orders.unshift(order);
        this.renderOrders();
      });
      window.restaurantSocket.on('order:payment', () => this.loadOrders(true));
    };
    connect();
    setInterval(() => this.loadOrders(true), 30000);
  }

  playAlert() {
    const fab = document.querySelector('.live-badge');
    fab?.classList.add('pulse');
    setTimeout(() => fab?.classList.remove('pulse'), 1000);
  }

  updateClock() {
    const el = document.getElementById('kitchenClock');
    if (el) {
      el.textContent = new Date().toLocaleString('de-DE', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  }

  async loadOrders(silent = false) {
    try {
      const result = await api.getOrders('?kitchen=true');
      this.orders = result.data || [];
      this.renderOrders();
      if (!silent) this.showToast('Orders synced');
    } catch (error) {
      document.getElementById('ordersGrid').innerHTML = `
        <div class="empty-state" style="display:block;grid-column:1/-1">
          <i class="fas fa-plug"></i>
          <h2>Server offline</h2>
          <p>cd server && npm start</p>
        </div>`;
    }
  }

  normalizeStatus(s) {
    const map = { pending: 'received', accepted: 'received', completed: 'served' };
    return map[s] || s;
  }

  getFilteredOrders() {
    const active = this.orders.filter((o) => !['served', 'cancelled'].includes(this.normalizeStatus(o.orderStatus)));
    if (this.filter === 'all') return active;
    return active.filter((o) => this.normalizeStatus(o.orderStatus) === this.filter);
  }

  renderOrders() {
    const grid = document.getElementById('ordersGrid');
    const empty = document.getElementById('emptyState');
    const filtered = this.getFilteredOrders();

    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    const flow = ['received', 'preparing', 'ready', 'served'];

    grid.innerHTML = filtered.map((order) => {
      const status = this.normalizeStatus(order.orderStatus);
      const time = new Date(order.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const itemsHtml = order.items.map((i) =>
        `<li><span class="qty">×${i.quantity}</span> ${i.name}</li>`
      ).join('');
      const inst = order.specialInstructions
        ? `<p class="special-inst"><i class="fas fa-note-sticky"></i> ${order.specialInstructions}</p>` : '';

      const buttons = flow.map((st) => {
        const idx = flow.indexOf(status);
        const targetIdx = flow.indexOf(st);
        const disabled = targetIdx < idx || status === 'served' ? 'disabled' : '';
        const labels = { received: 'Received', preparing: 'Preparing', ready: 'Ready', served: 'Served' };
        const cls = `btn-${st}`;
        return `<button class="${cls}" data-status="${st}" ${disabled}>${labels[st]}</button>`;
      }).join('');

      return `
        <article class="order-card" data-order-id="${order.orderId}">
          <div class="order-card-header">
            <div>
              <div class="order-id">${order.orderId}</div>
              <div class="table-badge"><i class="fas fa-chair"></i> Table ${order.tableNumber}</div>
              <span class="status-badge ${status}">${status}</span>
            </div>
            <div class="order-time"><i class="fas fa-clock"></i> ${time}</div>
          </div>
          <p class="customer-info"><i class="fas fa-user"></i> ${order.customerName}</p>
          <ul class="order-items-list">${itemsHtml}</ul>
          ${inst}
          <div class="order-actions">${buttons}</div>
        </article>`;
    }).join('');

    filtered.forEach((order) => this.bindButtons(order.orderId, this.normalizeStatus(order.orderStatus)));
  }

  bindButtons(orderId, currentStatus) {
    const card = document.querySelector(`[data-order-id="${orderId}"]`);
    if (!card) return;
    const flow = ['received', 'preparing', 'ready', 'served'];

    card.querySelectorAll('.order-actions button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const newStatus = btn.dataset.status;
        try {
          await api.updateOrderStatus(orderId, newStatus);
          this.showToast(`${orderId} → ${newStatus}`);
        } catch (e) {
          this.showToast(e.message, true);
        }
      });
    });
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('kitchenToast');
    toast.textContent = message;
    toast.style.borderColor = isError ? '#e85d5d' : 'var(--gold)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new KitchenDashboard();
});
