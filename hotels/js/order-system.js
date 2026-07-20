/**
 * Savory Haus — Restaurant POS cart & order workflow
 */
class RestaurantOrderSystem {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'savoryCart';
    this.gstRate = options.gstRate || 0.07;
    this.cart = [];
    this.cardQuantities = {};
    this.initDOM();
    this.loadCart();
    this.render();
  }

  initDOM() {
    if (!document.getElementById('floatingCartBtn')) {
      document.body.insertAdjacentHTML('beforeend', `
        <button class="floating-cart" id="floatingCartBtn" aria-label="Open cart">
          <i class="fas fa-receipt"></i>
          <span class="cart-badge" id="floatingCartBadge">0</span>
        </button>
        <div class="cart-drawer-overlay" id="cartDrawerOverlay"></div>
        <aside class="cart-drawer" id="cartDrawer">
          <div class="cart-drawer-header">
            <h2><i class="fas fa-utensils"></i> Your Order</h2>
            <button class="cart-drawer-close" id="cartDrawerClose"><i class="fas fa-times"></i></button>
          </div>
          <div class="cart-drawer-items" id="cartDrawerItems"></div>
          <div class="cart-drawer-footer" id="cartDrawerFooter">
            <div class="cart-totals">
              <div class="row"><span>Subtotal</span><span id="cartSubtotal">€0.00</span></div>
              <div class="row"><span>GST (7%)</span><span id="cartGst">€0.00</span></div>
              <div class="row grand"><span>Total</span><span id="cartGrandTotal">€0.00</span></div>
            </div>
            <button class="btn-place-order" id="btnPlaceOrder">Place Order</button>
            <p class="cart-note">Payment at counter after your meal</p>
          </div>
        </aside>
        <div class="order-modal-overlay" id="orderModalOverlay">
          <div class="order-modal" id="orderModal">
            <div id="orderFormView">
              <h2>Place Order</h2>
              <p class="subtitle">Order sent to kitchen & counter — pay when ready</p>
              <div class="order-summary-mini" id="orderSummaryMini"></div>
              <div class="order-form-field">
                <label for="orderType">Order Type</label>
                <select id="orderType">
                  <option value="dine-in" selected>Dine-in</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
              <div class="order-form-field dine-in-field">
                <label for="tableNumber">Table Number *</label>
                <input type="text" id="tableNumber" placeholder="e.g. 12" required>
              </div>
              <div class="order-form-field">
                <label for="customerName">Guest Name *</label>
                <input type="text" id="customerName" placeholder="Your name" required>
              </div>
              <div class="order-form-field">
                <label for="phoneNumber">Phone Number *</label>
                <input type="tel" id="phoneNumber" placeholder="e.g. +49 89 123 4567" required>
              </div>
              <div class="order-form-field delivery-field" style="display:none">
                <label for="deliveryAddress">Delivery Address</label>
                <input type="text" id="deliveryAddress" placeholder="Street, city, postcode">
              </div>
              <div class="order-form-field">
                <label for="paymentMethod">Payment Method</label>
                <select id="paymentMethod">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="online">Online</option>
                </select>
                <small class="order-form-hint">Payment will be completed at the counter after order placement.</small>
              </div>
              <div class="order-form-field">
                <label for="specialInstructions">Special Instructions</label>
                <textarea id="specialInstructions" rows="3" placeholder="Allergies, preferences…"></textarea>
              </div>
              <div class="order-modal-actions">
                <button type="button" class="btn-cancel-order" id="cancelOrderBtn">Cancel</button>
                <button type="button" class="btn-submit-order" id="submitOrderBtn">Send to Kitchen</button>
              </div>
            </div>
            <div id="orderSuccessView" style="display:none" class="order-success">
              <i class="fas fa-check-circle" style="font-size:3rem;color:var(--gold)"></i>
              <h2>Order Placed</h2>
              <p class="order-id-display" id="placedOrderId"></p>
              <p class="order-form-hint" style="margin:1rem 0">Kitchen is preparing your order.<br>Pay at the counter when ready.</p>
              <button class="btn-submit-order" id="closeSuccessBtn" style="width:100%">Continue</button>
            </div>
          </div>
        </div>
        <div class="pos-toast" id="posToast"></div>
      `);
    }

    this.els = {
      fab: document.getElementById('floatingCartBtn'),
      badge: document.getElementById('floatingCartBadge'),
      overlay: document.getElementById('cartDrawerOverlay'),
      drawer: document.getElementById('cartDrawer'),
      items: document.getElementById('cartDrawerItems'),
      footer: document.getElementById('cartDrawerFooter'),
      subtotal: document.getElementById('cartSubtotal'),
      gst: document.getElementById('cartGst'),
      grand: document.getElementById('cartGrandTotal'),
      placeOrder: document.getElementById('btnPlaceOrder'),
      orderOverlay: document.getElementById('orderModalOverlay'),
      orderForm: document.getElementById('orderFormView'),
      orderSuccess: document.getElementById('orderSuccessView'),
      toast: document.getElementById('posToast')
    };

    document.getElementById('floatingCartBtn')?.addEventListener('click', () => this.openDrawer());
    document.getElementById('cartDrawerClose')?.addEventListener('click', () => this.closeDrawer());
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeDrawer());
    document.getElementById('btnPlaceOrder')?.addEventListener('click', () => this.openPlaceOrderModal());
    document.getElementById('cancelOrderBtn')?.addEventListener('click', () => this.closePlaceOrderModal());
    document.getElementById('submitOrderBtn')?.addEventListener('click', () => this.submitOrder());
    document.getElementById('orderType')?.addEventListener('change', (event) => {
      const isDelivery = event.target.value === 'delivery';
      document.querySelectorAll('.delivery-field').forEach((el) => {
        el.style.display = isDelivery ? 'block' : 'none';
      });
      document.querySelectorAll('.dine-in-field').forEach((el) => {
        el.style.display = isDelivery ? 'none' : 'block';
      });
    });
    document.getElementById('closeSuccessBtn')?.addEventListener('click', () => {
      this.closePlaceOrderModal();
      this.closeDrawer();
    });
  }

  getCardQty(itemId) {
    return this.cardQuantities[itemId] || 1;
  }

  setCardQty(itemId, qty) {
    this.cardQuantities[itemId] = Math.max(1, Math.min(99, qty));
  }

  getTotals() {
    const subtotal = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const gst = subtotal * this.gstRate;
    return { subtotal, gst, total: subtotal + gst };
  }

  formatEuro(n) {
    return `€${n.toFixed(2)}`;
  }

  addToCart(item, qty) {
    const quantity = qty || this.getCardQty(item.id);
    const existing = this.cart.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.cart.push({ ...item, quantity });
    }
    this.saveCart();
    this.render();
    this.toast(`${item.name} added`);
    this.els.fab?.classList.add('pulse');
    setTimeout(() => this.els.fab?.classList.remove('pulse'), 500);
  }

  updateQty(id, qty) {
    const item = this.cart.find((i) => i.id === id);
    if (!item) return;
    if (qty <= 0) this.removeFromCart(id);
    else {
      item.quantity = qty;
      this.saveCart();
      this.render();
    }
  }

  removeFromCart(id) {
    this.cart = this.cart.filter((i) => i.id !== id);
    this.saveCart();
    this.render();
  }

  saveCart() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    const navCount = document.getElementById('cartCount');
    if (navCount) {
      navCount.textContent = this.cart.reduce((s, i) => s + i.quantity, 0);
    }
  }

  loadCart() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.cart = raw ? JSON.parse(raw) : [];
    } catch {
      this.cart = [];
    }
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
    this.render();
  }

  render() {
    const count = this.cart.reduce((s, i) => s + i.quantity, 0);
    if (this.els.badge) this.els.badge.textContent = count;

    const { subtotal, gst, total } = this.getTotals();
    if (this.els.subtotal) this.els.subtotal.textContent = this.formatEuro(subtotal);
    if (this.els.gst) this.els.gst.textContent = this.formatEuro(gst);
    if (this.els.grand) this.els.grand.textContent = this.formatEuro(total);
    if (this.els.placeOrder) this.els.placeOrder.disabled = count === 0;

    if (!this.els.items) return;

    if (count === 0) {
      this.els.items.innerHTML = `
        <div class="cart-drawer-empty">
          <i class="fas fa-receipt"></i>
          <p>Your order is empty</p>
          <p style="font-size:0.85rem;margin-top:8px">Browse the menu to add dishes</p>
        </div>`;
      return;
    }

    this.els.items.innerHTML = this.cart.map((item) => `
      <div class="cart-drawer-item">
        <img src="${item.image || ''}" alt="${item.name}" onerror="this.style.background='#2a2a2e'">
        <div class="cart-drawer-item-info">
          <h4>${item.name}</h4>
          <span class="line-price">${this.formatEuro(item.price * item.quantity)}</span>
          <div class="cart-drawer-qty">
            <button type="button" data-action="dec" data-id="${item.id}"><i class="fas fa-minus"></i></button>
            <span>${item.quantity}</span>
            <button type="button" data-action="inc" data-id="${item.id}"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <button class="remove-item" data-action="remove" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
      </div>
    `).join('');

    this.els.items.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const item = this.cart.find((i) => i.id === id);
        if (!item) return;
        if (btn.dataset.action === 'inc') this.updateQty(id, item.quantity + 1);
        if (btn.dataset.action === 'dec') this.updateQty(id, item.quantity - 1);
        if (btn.dataset.action === 'remove') this.removeFromCart(id);
      });
    });
  }

  openDrawer() {
    this.els.overlay?.classList.add('open');
    this.els.drawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeDrawer() {
    this.els.overlay?.classList.remove('open');
    this.els.drawer?.classList.remove('open');
    document.body.style.overflow = '';
  }

  openPlaceOrderModal() {
    if (this.cart.length === 0) return;
    const { subtotal, gst, total } = this.getTotals();
    const mini = document.getElementById('orderSummaryMini');
    if (mini) {
      mini.innerHTML = `
        <strong>${this.cart.reduce((s, i) => s + i.quantity, 0)} items</strong> ·
        Subtotal ${this.formatEuro(subtotal)} · GST ${this.formatEuro(gst)} ·
        <strong style="color:var(--gold)">Total ${this.formatEuro(total)}</strong>`;
    }
    this.els.orderForm.style.display = 'block';
    this.els.orderSuccess.style.display = 'none';
    this.els.orderOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closePlaceOrderModal() {
    this.els.orderOverlay?.classList.remove('open');
    document.body.style.overflow = this.els.drawer?.classList.contains('open') ? 'hidden' : '';
  }

  async orderNow(item) {
    const qty = this.getCardQty(item.id);
    this.addToCart(item, qty);
    this.openDrawer();
    setTimeout(() => this.openPlaceOrderModal(), 400);
  }

  async submitOrder() {
    const orderType = document.getElementById('orderType')?.value || 'dine-in';
    const tableNumber = document.getElementById('tableNumber')?.value?.trim();
    const customerName = document.getElementById('customerName')?.value?.trim();
    const phoneNumber = document.getElementById('phoneNumber')?.value?.trim();
    const deliveryAddress = document.getElementById('deliveryAddress')?.value?.trim() || '';
    const paymentMethod = document.getElementById('paymentMethod')?.value || 'cash';
    const specialInstructions = document.getElementById('specialInstructions')?.value?.trim() || '';

    if (!customerName || !phoneNumber) {
      this.toast('Please provide guest name and phone number', true);
      return;
    }

    if (orderType === 'dine-in' && !tableNumber) {
      this.toast('Please enter table number for dine-in orders', true);
      return;
    }

    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const { subtotal, gst, total } = this.getTotals();
    const orderData = {
      orderType,
      tableNumber: tableNumber || '',
      customerName,
      phone: phoneNumber,
      address: deliveryAddress,
      paymentMethod,
      specialInstructions,
      items: this.cart.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        image: i.image || ''
      })),
      subtotal,
      gst,
      tax: gst,
      total
    };
    console.log('[ORDER SYSTEM] Submit Order', orderData);

    try {
      const result = await api.createOrder(orderData);
      console.log('[ORDER SYSTEM] Order API response', result);

      document.getElementById('placedOrderId').textContent = result.data.orderId;
      this.els.orderForm.style.display = 'none';
      this.els.orderSuccess.style.display = 'block';
      this.clearCart();
      document.getElementById('tableNumber').value = '';
      document.getElementById('customerName').value = '';
      document.getElementById('phoneNumber').value = '';
      document.getElementById('deliveryAddress').value = '';
      document.getElementById('paymentMethod').value = 'cash';
      document.getElementById('specialInstructions').value = '';
      this.toast('Order sent to kitchen!');
    } catch (err) {
      const base = window.API_BASE || 'http://localhost:5000';
      this.toast(`${err.message || 'Failed to place order'} — check server at ${base}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send to Kitchen';
    }
  }

  toast(msg, isError) {
    if (!this.els.toast) return;
    this.els.toast.textContent = msg;
    this.els.toast.style.borderColor = isError ? '#e85d5d' : 'var(--gold)';
    this.els.toast.classList.add('show');
    setTimeout(() => this.els.toast.classList.remove('show'), 2800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.orderSystem = new RestaurantOrderSystem();
});
