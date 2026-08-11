// Shared order store for Angaar Dhaba staff/customer flow.
//
// Talks to the real backend (Express + MongoDB + Socket.io, in /server) over
// HTTP + WebSocket, so every device — a customer's phone, the kitchen
// tablet, a waiter's phone, the counter PC — sees the same live order data.
// Every page still only talks to OrderStore, never to the network directly,
// so this file is the only thing that changed when the backend arrived.
const OrderStore = (() => {
  // TODO: replace with your deployed Render backend URL once you've created it
  // (see the deployment README). Example: 'https://angaar-dhaba-api.onrender.com'
  const API_BASE = 'https://hotel-rag-gen-glb-1.onrender.com';
  const listeners = new Set();
  let socket = null;

  function connectSocket() {
    if (socket || typeof io === 'undefined') return;
    socket = io(API_BASE);
    // Same event names the server emits == the same actions orders.js used
    // to emit() locally, so this just re-wraps them into the { type, payload,
    // at } shape OrderStore.onChange(fn) callers have always received.
    ['order_created', 'order_updated', 'bill_requested', 'invoice_generated', 'order_paid'].forEach((type) => {
      socket.on(type, (msg) => {
        listeners.forEach((fn) => { try { fn({ type, payload: msg.payload, at: msg.at }); } catch (e) {} });
      });
    });
  }

  function onChange(fn) {
    connectSocket();
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function api(path, options) {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  // Fixed restaurant-wide GST rate — billing never requires manually entering this.
  // Pure math, so this (and the functions below it) stay client-side unchanged —
  // Counter uses these for a live preview before generateInvoice() locks in the
  // server's authoritative numbers.
  const GST_RATE = 5;
  function getGstRate(){ return GST_RATE; }

  function billBreakdown(subtotal, rate){
    const r = rate == null ? getGstRate() : rate;
    const gstAmount = Math.round(subtotal * r / 100 * 100) / 100;
    const halfRate = Math.round(r / 2 * 100) / 100;
    const half = Math.round(gstAmount / 2 * 100) / 100;
    return { subtotal, rate: r, halfRate, gst: gstAmount, cgst: half, sgst: half, total: Math.round((subtotal + gstAmount) * 100) / 100 };
  }

  function genId(){ return 'EP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase(); }

  function priceNumber(p){
    if(typeof p === 'number') return p;
    const m = String(p).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }
  function itemTotal(it){ return priceNumber(it.price) * (it.qty || 1); }
  function orderTotal(order){ return order.items.reduce((s,it)=>s + itemTotal(it), 0); }

  const ACTIVE_STATUSES = ['new','preparing','ready','delivered'];

  // Every function below now returns a Promise (it's a network call, not an
  // instant localStorage read) — callers use await/.then() instead of
  // reading a return value synchronously.
  function createOrder({ table, items, notes, placedBy, waiterName }){
    return api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ table, items, notes, placedBy, waiterName })
    });
  }

  function updateOrder(id, patch){
    return api(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  }

  function requestBill(table, method){
    return api(`/api/orders/table/${encodeURIComponent(table)}/request-bill`, {
      method: 'POST',
      body: JSON.stringify({ method })
    });
  }

  function generateInvoice(table){
    return api(`/api/orders/table/${encodeURIComponent(table)}/generate-invoice`, { method: 'POST' });
  }

  function confirmPayment(table){
    return api(`/api/orders/table/${encodeURIComponent(table)}/confirm-payment`, { method: 'POST' });
  }

  function getAll(){ return api('/api/orders'); }
  function getByTable(table){ return api(`/api/orders/table/${encodeURIComponent(table)}`); }
  function getActiveByTable(table){ return api(`/api/orders/table/${encodeURIComponent(table)}/active`); }

  return {
    ACTIVE_STATUSES,
    createOrder, updateOrder, requestBill, generateInvoice, confirmPayment,
    getAll, getByTable, getActiveByTable,
    onChange, orderTotal, itemTotal, priceNumber, genId,
    getGstRate, billBreakdown
  };
})();
