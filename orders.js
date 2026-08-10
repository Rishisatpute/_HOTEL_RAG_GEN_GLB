// Shared order store for Angaar Dhaba staff/customer flow.
//
// For now (no backend yet) this syncs across browser TABS on the same device only,
// via localStorage (persistence) + BroadcastChannel (instant cross-tab push).
// Open Menu / Kitchen / Waiter / Counter as separate tabs on one browser to see it live.
// Swapping this for a real backend later only means rewriting the functions below —
// every page talks to OrderStore, never to localStorage directly.
const OrderStore = (() => {
  const KEY = 'ekpunjab_orders_v1';
  const INVOICE_SEQ_KEY = 'ekpunjab_invoice_seq_v1';
  const CHANNEL = 'ekpunjab_orders_v1';
  // Fixed restaurant-wide GST rate — billing never requires manually entering this.
  const GST_RATE = 5;
  let bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch(e) { bc = null; }
  const listeners = new Set();

  function readAll(){
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ return []; }
  }
  function writeAll(orders){ localStorage.setItem(KEY, JSON.stringify(orders)); }

  function getGstRate(){ return GST_RATE; }
  // subtotal (sum of item totals) -> { subtotal, rate, gst, cgst, sgst, total }, rounded to paise.
  // GST is split evenly into CGST + SGST, as required for an intra-state (same-state) sale.
  function billBreakdown(subtotal, rate){
    const r = rate == null ? getGstRate() : rate;
    const gstAmount = Math.round(subtotal * r / 100 * 100) / 100;
    const halfRate = Math.round(r / 2 * 100) / 100;
    const half = Math.round(gstAmount / 2 * 100) / 100;
    return { subtotal, rate: r, halfRate, gst: gstAmount, cgst: half, sgst: half, total: Math.round((subtotal + gstAmount) * 100) / 100 };
  }

  // Sequential invoice numbers, restaurant-wide (INV-EKP-000001, 000002, ...).
  function nextInvoiceNumber(){
    const current = parseInt(localStorage.getItem(INVOICE_SEQ_KEY), 10) || 0;
    const next = current + 1;
    localStorage.setItem(INVOICE_SEQ_KEY, String(next));
    return 'INV-EKP-' + String(next).padStart(6, '0');
  }

  function emit(type, payload){
    const msg = { type, payload, at: Date.now() };
    listeners.forEach(fn=>{ try{ fn(msg); }catch(e){} });
    if(bc){ try{ bc.postMessage(msg); }catch(e){} }
  }
  if(bc){
    bc.onmessage = (ev)=>{ listeners.forEach(fn=>{ try{ fn(ev.data); }catch(e){} }); };
  }
  // Fallback for browsers without BroadcastChannel: the native 'storage' event
  // fires in OTHER tabs whenever localStorage changes.
  window.addEventListener('storage', (e)=>{
    if(e.key===KEY){ listeners.forEach(fn=>{ try{ fn({type:'sync', payload:null, at:Date.now()}); }catch(err){} }); }
  });

  function onChange(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }

  function genId(){ return 'EP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase(); }

  function priceNumber(p){
    if(typeof p === 'number') return p;
    const m = String(p).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }
  function itemTotal(it){ return priceNumber(it.price) * (it.qty || 1); }
  function orderTotal(order){ return order.items.reduce((s,it)=>s + itemTotal(it), 0); }

  const ACTIVE_STATUSES = ['new','preparing','ready','delivered'];

  function createOrder({ table, items, notes, placedBy, waiterName }){
    const orders = readAll();
    const order = {
      id: genId(),
      table: table || 'Takeaway',
      items: items.map(it=>({ name: it.name, price: it.price, qty: it.qty || 1, special: !!it.special })),
      status: 'new', // new -> preparing -> ready -> delivered -> bill_requested -> paid
      paymentMethodRequested: null,
      paymentMethod: null,
      billRequestedAt: null,
      paidAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: notes || '',
      placedBy: placedBy === 'waiter' ? 'waiter' : 'customer',
      waiterName: waiterName || ''
    };
    orders.push(order);
    writeAll(orders);
    emit('order_created', order);
    return order;
  }

  function updateOrder(id, patch){
    const orders = readAll();
    const idx = orders.findIndex(o=>o.id===id);
    if(idx===-1) return null;
    orders[idx] = Object.assign({}, orders[idx], patch, { updatedAt: Date.now() });
    writeAll(orders);
    emit('order_updated', orders[idx]);
    return orders[idx];
  }

  // Waiter requests payment for a table: every DELIVERED order there moves to bill_requested
  // with the chosen method, grouped under one billId. Orders still cooking (new/preparing/
  // ready) are left alone — they'll join a later bill once they're delivered too.
  function requestBill(table, method){
    const orders = readAll();
    const active = orders.filter(o=>o.table===table && o.status==='delivered');
    if(active.length===0) return [];
    const now = Date.now(); // shared so this whole batch can be grouped into one bill later
    const billId = genId();
    active.forEach(o=>{ o.status='bill_requested'; o.paymentMethodRequested=method; o.billRequestedAt=now; o.billId=billId; o.updatedAt=now; });
    writeAll(orders);
    emit('bill_requested', { table, method, orders: active });
    return active;
  }

  // Locks in the invoice number + GST breakdown for a table's pending bill, without marking
  // it paid. Idempotent — calling it again just returns the already-generated invoice instead
  // of minting a new number, so Counter staff can click it freely.
  function generateInvoice(table){
    const orders = readAll();
    const pending = orders.filter(o=>o.table===table && o.status==='bill_requested');
    if(pending.length===0) return [];
    if(pending[0].invoiceNo) return pending;
    const now = Date.now();
    const subtotal = pending.reduce((s,o)=>s+orderTotal(o),0);
    const bill = billBreakdown(subtotal);
    const invoiceNo = nextInvoiceNumber();
    pending.forEach(o=>{
      o.gstRate=bill.rate; o.halfRate=bill.halfRate; o.gstAmount=bill.gst;
      o.cgstAmount=bill.cgst; o.sgstAmount=bill.sgst;
      o.billSubtotal=bill.subtotal; o.billTotal=bill.total;
      o.invoiceNo=invoiceNo; o.invoiceGeneratedAt=now; o.updatedAt=now;
    });
    writeAll(orders);
    emit('invoice_generated', { table, orders: pending });
    return pending;
  }

  // Counter confirms money actually received, using whichever method the waiter requested.
  // generateInvoice() is idempotent, so calling it here just ensures a bill that skipped
  // straight to "Confirm Payment" still gets a locked-in invoice number and GST breakdown.
  function confirmPayment(table){
    const generated = generateInvoice(table);
    if(generated.length===0) return [];
    const orders = readAll();
    const pending = orders.filter(o=>o.table===table && o.status==='bill_requested');
    const method = pending[0].paymentMethodRequested;
    const now = Date.now();
    pending.forEach(o=>{ o.status='paid'; o.paymentMethod=method; o.paidAt=now; o.updatedAt=now; });
    writeAll(orders);
    emit('order_paid', { table, method, orders: pending });
    return pending;
  }

  function getAll(){ return readAll(); }
  function getByTable(table){ return readAll().filter(o=>o.table===table); }
  function getActiveByTable(table){ return readAll().filter(o=>o.table===table && o.status!=='paid'); }

  return {
    ACTIVE_STATUSES,
    createOrder, updateOrder, requestBill, generateInvoice, confirmPayment,
    getAll, getByTable, getActiveByTable,
    onChange, orderTotal, itemTotal, priceNumber, genId,
    getGstRate, billBreakdown
  };
})();
