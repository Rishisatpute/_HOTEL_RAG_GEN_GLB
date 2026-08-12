// Shared order store for Angaar Dhaba staff/customer flow.
//
// Talks to the PHP + MySQL backend (server-php/) over HTTP. Devices stay in
// sync via polling — every device — a customer's phone, the kitchen
// tablet, a waiter's phone, the counter PC — refetches automatically every
// few seconds. (Shared/cPanel hosting can't run a persistent WebSocket
// server, so this replaces the earlier Socket.io push; in practice a few
// seconds of lag is barely noticeable for this use case.)
// Every page still only talks to OrderStore, never to the network directly,
// so this file is the only thing that changed when the backend moved to PHP.
const OrderStore = (() => {
  // TODO: replace with your deployed PHP backend URL (e.g. https://api.angaardhaba.com
  // or wherever server-php/ is hosted on MilesWeb). See server-php/README.md.
  const API_BASE = 'http://localhost:8000';
  const POLL_INTERVAL_MS = 4000;

  const listeners = new Set();
  let pollTimer = null;

  // Every page's render() already does its own diffing (comparing known
  // order ids/statuses between calls) to decide when to flash/beep for
  // something new — that was originally a backup in case a socket event
  // was missed, but it means this poll tick doesn't need to carry any
  // meaningful event type or payload; "something might have changed, go
  // re-check" is enough.
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      listeners.forEach((fn) => { try { fn({ type: 'poll', payload: null, at: Date.now() }); } catch (e) {} });
    }, POLL_INTERVAL_MS);
  }

  function onChange(fn) {
    startPolling();
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

  // Every function below returns a Promise (it's a network call) — callers
  // use await/.then() instead of reading a return value synchronously.
  function createOrder({ table, items, notes, placedBy, waiterName }){
    return api('/api/orders.php', {
      method: 'POST',
      body: JSON.stringify({ table, items, notes, placedBy, waiterName })
    });
  }

  function updateOrder(id, patch){
    return api(`/api/order_update.php?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  }

  function requestBill(table, method){
    return api(`/api/request_bill.php?table=${encodeURIComponent(table)}`, {
      method: 'POST',
      body: JSON.stringify({ method })
    });
  }

  function generateInvoice(table){
    return api(`/api/generate_invoice.php?table=${encodeURIComponent(table)}`, { method: 'POST' });
  }

  function confirmPayment(table){
    return api(`/api/confirm_payment.php?table=${encodeURIComponent(table)}`, { method: 'POST' });
  }

  // Sends the full itemized bill to the counter's physical billing printer
  // (via the local Print Agent) — separate from the on-screen invoice modal,
  // which stays as a visual/browser-print fallback.
  function printBill(table){
    return api(`/api/print_bill.php?table=${encodeURIComponent(table)}`, { method: 'POST' });
  }

  function getAll(){ return api('/api/orders.php'); }
  function getByTable(table){ return api(`/api/orders.php?table=${encodeURIComponent(table)}`); }
  function getActiveByTable(table){ return api(`/api/orders.php?table=${encodeURIComponent(table)}&active=1`); }

  return {
    ACTIVE_STATUSES,
    createOrder, updateOrder, requestBill, generateInvoice, confirmPayment, printBill,
    getAll, getByTable, getActiveByTable,
    onChange, orderTotal, itemTotal, priceNumber, genId,
    getGstRate, billBreakdown
  };
})();
