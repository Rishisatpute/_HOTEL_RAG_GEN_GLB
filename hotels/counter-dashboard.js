/**
 * Counter / Billing Dashboard — Real-time POS
 */
class CounterDashboard {
  constructor() {
    this.orders = [];
    this.reservations = [];
    this.view = 'orders';
    this.selectedPayment = null;
    this.currentPayOrder = null;
    this.init();
  }

  init() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    document.getElementById('refreshCounter')?.addEventListener('click', () => this.loadAll());
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('counterSidebar')?.classList.toggle('open');
    });

    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
        el.classList.add('active');
        this.view = el.dataset.view;
        this.render();
      });
    });

    document.getElementById('closePaymentModal')?.addEventListener('click', () => this.closePaymentModal());
    document.getElementById('paymentOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'paymentOverlay') this.closePaymentModal();
    });

    document.querySelectorAll('.pay-method').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pay-method').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPayment = btn.dataset.method;
        const confirm = document.getElementById('confirmPayBtn');
        confirm.disabled = false;
        confirm.textContent = `Confirm ${btn.dataset.method.toUpperCase()} Payment`;
      });
    });

    document.getElementById('confirmPayBtn')?.addEventListener('click', () => this.confirmPayment());

    this.loadAll();
    this.setupSocket();
  }

  setupSocket() {
    const connect = () => {
      if (!window.restaurantSocket) {
        setTimeout(connect, 500);
        return;
      }
      window.restaurantSocket.emit('join', 'counter');
      window.restaurantSocket.on('order:new', (order) => {
        this.orders.unshift(order);
        this.render();
        this.toast(`New bill — Table ${order.tableNumber}`);
      });
      window.restaurantSocket.on('order:updated', (o) => this.mergeOrder(o));
      window.restaurantSocket.on('order:payment', (o) => this.mergeOrder(o));
      window.restaurantSocket.on('reservation:new', (r) => {
        this.reservations.unshift(r);
        this.render();
        this.toast(`New reservation — ${r.customerName} · ${r.bookingDate} ${r.bookingTime}`);
      });
    };
    connect();
  }

  mergeOrder(order) {
    const i = this.orders.findIndex((o) => o.orderId === order.orderId);
    if (i >= 0) this.orders[i] = order;
    else this.orders.unshift(order);
    this.render();
  }

  updateClock() {
    const el = document.getElementById('counterClock');
    if (el) el.textContent = new Date().toLocaleString('de-DE');
  }

  async loadAll() {
    const grid = document.getElementById('counterGrid');
    try {
      const [ordersRes, reservationsRes] = await Promise.all([
        api.getCounterOrders(),
        api.getReservations()
      ]);
      this.orders = ordersRes.data || [];
      this.reservations = reservationsRes.data || [];
      this.render();
    } catch (e) {
      grid.innerHTML = `<p class="loading-placeholder">${e.message || 'Cannot connect to server'}</p>`;
    }
  }

  normalizeStatus(s) {
    const map = { pending: 'received', accepted: 'received', completed: 'served' };
    return map[s] || s;
  }

  getDisplayedOrders() {
    if (this.view === 'unpaid') {
      return this.orders.filter((o) => o.paymentStatus === 'pending');
    }
    return this.orders.filter((o) => o.orderStatus !== 'cancelled');
  }

  getDisplayedReservations() {
    return this.reservations.filter((r) => r.status !== 'cancelled');
  }

  updateStats() {
    const active = this.orders.filter((o) => o.paymentStatus === 'pending' && o.orderStatus !== 'cancelled').length;
    const unpaid = this.orders.filter((o) => o.paymentStatus === 'pending').length;
    const paidToday = this.orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.total, 0);
    const reservationCount = this.getDisplayedReservations().length;

    document.getElementById('statActive').textContent = active;
    document.getElementById('statUnpaid').textContent = unpaid;
    document.getElementById('statPaid').textContent = `€${paidToday.toFixed(2)}`;
    document.getElementById('liveBadge').textContent = active;

    const resStat = document.getElementById('statReservations');
    const resBadge = document.getElementById('reservationBadge');
    if (resStat) resStat.textContent = reservationCount;
    if (resBadge) resBadge.textContent = reservationCount;
  }

  render() {
    this.updateStats();
    const grid = document.getElementById('counterGrid');

    if (this.view === 'reservations') {
      const list = this.getDisplayedReservations();
      if (!list.length) {
        grid.innerHTML = '<p class="loading-placeholder">No reservations yet</p>';
        return;
      }
      grid.innerHTML = list.map((r) => this.renderReservationCard(r)).join('');
      return;
    }

    const list = this.getDisplayedOrders();
    if (!list.length) {
      grid.innerHTML = '<p class="loading-placeholder">No orders to display</p>';
      return;
    }

    grid.innerHTML = list.map((o) => this.renderBillCard(o)).join('');
    list.forEach((o) => this.bindCardActions(o));
  }

  renderReservationCard(r) {
    const dietary = r.dietary?.length ? r.dietary.join(', ') : 'None';
    const dateLabel = r.bookingDate
      ? new Date(r.bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '—';

    return `
      <article class="counter-bill-card counter-reservation-card" data-reservation-id="${r.reservationId}">
        <div class="bill-header">
          <div>
            <div class="order-id">${r.reservationId}</div>
            <div class="table-num"><small>RESERVATION</small>${r.guestCount} guests</div>
          </div>
          <span class="status-badge ${r.status || 'confirmed'}">${r.status || 'confirmed'}</span>
        </div>
        <p class="bill-meta"><i class="fas fa-user"></i> ${r.customerName}</p>
        <p class="bill-meta"><i class="fas fa-calendar"></i> ${dateLabel} · <i class="fas fa-clock"></i> ${r.bookingTime}</p>
        <p class="bill-meta"><i class="fas fa-envelope"></i> ${r.email} · <i class="fas fa-phone"></i> ${r.phone}</p>
        ${r.occasion ? `<p class="bill-meta"><i class="fas fa-gift"></i> ${r.occasion}</p>` : ''}
        ${r.specialRequests ? `<p class="special-inst">${r.specialRequests}</p>` : ''}
        <p class="bill-meta"><i class="fas fa-leaf"></i> Dietary: ${dietary}</p>
      </article>`;
  }

  renderBillCard(order) {
    const paid = order.paymentStatus === 'paid';
    const status = this.normalizeStatus(order.orderStatus);
    const time = new Date(order.createdAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const items = order.items.map((i) =>
      `<li><span>${i.name} ×${i.quantity}</span><span>€${(i.price * i.quantity).toFixed(2)}</span></li>`
    ).join('');

    return `
      <article class="counter-bill-card ${paid ? 'paid' : ''}" data-id="${order.orderId}">
        <div class="bill-header">
          <div>
            <div class="order-id">${order.orderId}</div>
            <div class="table-num"><small>TABLE</small>${order.tableNumber}</div>
          </div>
          <div style="text-align:right">
            <span class="status-badge ${status}">${status}</span>
            <span class="status-badge ${order.paymentStatus === 'paid' ? 'completed' : 'pending'}" style="display:block;margin-top:6px">${order.paymentStatus}</span>
          </div>
        </div>
        <p class="bill-meta"><i class="fas fa-user"></i> ${order.customerName} · <i class="fas fa-clock"></i> ${time}</p>
        ${order.specialInstructions ? `<p class="special-inst">${order.specialInstructions}</p>` : ''}
        <ul class="bill-items">${items}</ul>
        <div class="bill-totals">
          <div class="row"><span>Subtotal</span><span>€${order.subtotal.toFixed(2)}</span></div>
          <div class="row"><span>GST (7%)</span><span>€${(order.gst || order.tax || 0).toFixed(2)}</span></div>
          <div class="row grand"><span>Total</span><span>€${order.total.toFixed(2)}</span></div>
        </div>
        <div class="bill-actions">
          <button data-action="invoice"><i class="fas fa-file-invoice"></i> Invoice</button>
          <button data-action="print"><i class="fas fa-print"></i> Print Bill</button>
          <button class="btn-pay" data-action="pay" ${paid ? 'disabled' : ''}>${paid ? 'Paid ✓' : 'Take Payment'}</button>
        </div>
      </article>`;
  }

  bindCardActions(order) {
    const card = document.querySelector(`[data-id="${order.orderId}"]`);
    if (!card) return;

    card.querySelector('[data-action="pay"]')?.addEventListener('click', () => this.openPaymentModal(order));
    card.querySelector('[data-action="print"]')?.addEventListener('click', () => this.printBill(order));
    card.querySelector('[data-action="invoice"]')?.addEventListener('click', () => this.generateInvoice(order));
  }

  openPaymentModal(order) {
    this.currentPayOrder = order;
    this.selectedPayment = null;
    document.querySelectorAll('.pay-method').forEach((b) => b.classList.remove('selected'));
    document.getElementById('paymentOrderRef').textContent = `${order.orderId} · Table ${order.tableNumber}`;
    document.getElementById('paymentAmount').textContent = `€${order.total.toFixed(2)}`;
    const btn = document.getElementById('confirmPayBtn');
    btn.disabled = true;
    btn.textContent = 'Select payment method';
    document.getElementById('paymentOverlay').classList.add('open');
  }

  closePaymentModal() {
    document.getElementById('paymentOverlay').classList.remove('open');
    this.currentPayOrder = null;
  }

  async confirmPayment() {
    if (!this.currentPayOrder || !this.selectedPayment) return;
    const btn = document.getElementById('confirmPayBtn');
    btn.disabled = true;
    try {
      await api.updatePayment(this.currentPayOrder.orderId, this.selectedPayment, 'paid', true);
      this.toast('Payment recorded');
      this.closePaymentModal();
      await this.loadAll();
    } catch (e) {
      this.toast(e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  printBill(order) {
    const html = this.buildBillHTML(order, false);
    const area = document.getElementById('printArea');
    area.innerHTML = html;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Bill ${order.orderId}</title><style>body{font-family:Georgia,serif;padding:24px;max-width:400px;margin:0 auto}h1{text-align:center}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dotted #ccc}.total{font-weight:bold;font-size:1.2em}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }

  async generateInvoice(order) {
    await api.updatePayment(order.orderId, order.paymentMethod || '', order.paymentStatus, true);
    this.printBill({ ...order, invoiceGenerated: true });
    this.toast('Invoice generated');
  }

  buildBillHTML(order, invoice) {
    const rows = order.items.map((i) =>
      `<tr><td>${i.name} ×${i.quantity}</td><td style="text-align:right">€${(i.price * i.quantity).toFixed(2)}</td></tr>`
    ).join('');
    return `
      <h1>SAVORY HAUS</h1>
      <p style="text-align:center">Maximilianstraße 12, München</p>
      <hr>
      <p><strong>${invoice ? 'INVOICE' : 'BILL'}</strong> ${order.orderId}<br>
      Table ${order.tableNumber} · ${order.customerName}<br>
      ${new Date(order.createdAt).toLocaleString('de-DE')}</p>
      <table>${rows}</table>
      <p>Subtotal: €${order.subtotal.toFixed(2)}<br>
      GST: €${(order.gst || 0).toFixed(2)}<br>
      <span class="total">Total: €${order.total.toFixed(2)}</span></p>
      <p>Payment: ${order.paymentStatus} ${order.paymentMethod ? `(${order.paymentMethod})` : ''}</p>
      <p style="text-align:center;margin-top:24px;font-size:0.85em">Thank you for dining with us</p>`;
  }

  toast(msg, err) {
    const t = document.getElementById('counterToast');
    t.textContent = msg;
    t.className = `toast show ${err ? 'error' : ''}`;
    setTimeout(() => t.classList.remove('show'), 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CounterDashboard();
});
