// Angaar Dhaba — Counter: confirm payment, generate & print invoices.
(() => {
  if(!EkCommon.requireStaffAccess()) return; // redirects to staff-login.html if not verified

  let restaurant = null;
  let knownBillKeys = new Set();
  let firstRender = true;
  let selectedDate = null; // 'YYYY-MM-DD', or null for the default "last hour" view
  // Invoices (GSTIN line, UPI QR) need restaurant data from menu-data.json. On a slow
  // connection that fetch can still be in flight when staff click "Print Bill" — openInvoice()
  // awaits this promise so the invoice never silently renders without it.
  const restaurantReady = fetch('menu-data.json?v=18').then(r=>r.json()).then(data=>{ restaurant = data.restaurant; }).catch(()=>{});

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    // render() already diffs known pending-bill table keys itself to decide
    // when to flash/beep, so onChange just needs to trigger a re-check.
    OrderStore.onChange(() => render());
    document.getElementById('closeInvoiceBtn').addEventListener('click', closeInvoice);
    document.getElementById('printInvoiceBtn').addEventListener('click', ()=>window.print());
    document.getElementById('invoiceOverlay').addEventListener('click', (e)=>{ if(e.target.id==='invoiceOverlay') closeInvoice(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeInvoice(); });
    document.getElementById('invoiceDateFilter').addEventListener('change', (e)=>{
      selectedDate = e.target.value || null;
      loadRecentInvoices();
    });
    document.getElementById('clearDateFilterBtn').addEventListener('click', ()=>{
      selectedDate = null;
      document.getElementById('invoiceDateFilter').value = '';
      loadRecentInvoices();
    });
  });

  // A bill with no invoice generated yet always uses today's live GST rate. Once
  // generateInvoice() (or confirmPayment(), which calls it) has run, the rate, GST
  // breakdown and invoice number are locked in and read straight off the order.
  function billFor(orders){
    const first = orders[0];
    if(first && first.billTotal != null){
      return {
        subtotal: first.billSubtotal, rate: first.gstRate, halfRate: first.halfRate,
        gst: first.gstAmount, cgst: first.cgstAmount, sgst: first.sgstAmount,
        total: first.billTotal, invoiceNo: first.invoiceNo || first.id
      };
    }
    const subtotal = orders.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
    return Object.assign({ invoiceNo: null }, OrderStore.billBreakdown(subtotal));
  }

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }
  function flashPending(){
    EkCommon.alertChime();
    const col = document.querySelector('.waiter-section');
    col.classList.add('flash'); setTimeout(()=>col.classList.remove('flash'), 1600);
  }

  function groupByTable(orders){
    const g = {};
    orders.forEach(o=>{ (g[o.table] = g[o.table] || []).push(o); });
    return g;
  }

  async function render(){
    let orders;
    // Paid bills are deliberately excluded — orders only ever holds currently-active
    // business now; paid history lives in invoice_log/invoice_items (see loadRecentInvoices).
    try{ orders = await OrderStore.getByStatuses(['bill_requested']); }
    catch(err){ return; } // transient network hiccup — the 15s interval will retry
    const pendingGroups = groupByTable(orders);

    if(!firstRender){
      const currentKeys = new Set(Object.keys(pendingGroups));
      let hasNew = false;
      currentKeys.forEach(k=>{ if(!knownBillKeys.has(k)) hasNew = true; });
      if(hasNew) flashPending();
    }
    knownBillKeys = new Set(Object.keys(pendingGroups));
    firstRender = false;

    renderPending(pendingGroups);
    loadRecentInvoices();
  }

  // Default: invoices paid in the last hour. A selected date instead browses that
  // whole calendar day. The range is computed fresh each call (not cached) so the
  // "last hour" window keeps rolling forward on every poll.
  async function loadRecentInvoices(){
    let from, to;
    if(selectedDate){
      const [y, m, d] = selectedDate.split('-').map(Number);
      from = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      to = from + 24 * 60 * 60 * 1000 - 1;
    } else {
      from = Date.now() - 60 * 60 * 1000;
      to = Date.now();
    }
    let invoices;
    try{ invoices = await OrderStore.getInvoices(from, to); }
    catch(err){ return; } // transient network hiccup — the 15s interval will retry
    renderRecent(invoices);
  }

  function renderPending(groups){
    const host = document.getElementById('colPending');
    const tables = Object.keys(groups);
    document.getElementById('countPending').textContent = tables.length;
    host.innerHTML = '';
    if(tables.length===0){ host.innerHTML = '<p class="kds-empty">No bills waiting</p>'; return; }
    tables.forEach(table=>{
      const ordersForTable = groups[table];
      const bill = billFor(ordersForTable);
      const method = ordersForTable[0].paymentMethodRequested;
      const waiterOrder = ordersForTable.find(o=>o.placedBy==='waiter');
      const waiterTag = waiterOrder ? `<span class="waiter-tag">🧑‍🍳 ${escapeHtml(waiterOrder.waiterName || 'Waiter')}</span>` : '';
      const card = document.createElement('div'); card.className = 'kds-card bill-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">${escapeHtml(EkCommon.tableLabel(table))}</span>${waiterTag}<span class="method-chip method-${method}">${methodLabel(method)}</span>`;
      const itemsList = document.createElement('ul'); itemsList.className='kds-items';
      ordersForTable.forEach(o=>o.items.forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; itemsList.appendChild(li); }));
      const totalRow = document.createElement('div'); totalRow.className='bill-breakdown'; totalRow.innerHTML = billBreakdownHtml(bill);
      const invoiceLine = document.createElement('div'); invoiceLine.className = 'kds-notes';
      invoiceLine.innerHTML = bill.invoiceNo ? `Invoice: <strong>${escapeHtml(bill.invoiceNo)}</strong>` : 'Invoice not generated yet';
      const actions = document.createElement('div'); actions.className='kds-actions wrap';

      // Invoice generation itself has no standalone button anymore — both actions
      // below need a locked-in invoice number to work, so each generates one
      // first if it isn't there yet (a no-op once it already exists).
      const printBtn = document.createElement('button'); printBtn.className = 'btn outline sm';
      printBtn.textContent = 'Print Bill';
      printBtn.addEventListener('click', async ()=>{
        try{
          const generated = await OrderStore.generateInvoice(table); // no-op if already generated
          if(generated.length) openInvoice(generated, method);
          await OrderStore.printBill(table); // sends the bill to the physical billing (thermal) printer
          EkCommon.toast('Bill sent to billing printer');
        }catch(err){ EkCommon.toast(err.message); }
      });

      const confirmBtn = document.createElement('button'); confirmBtn.className = 'btn primary sm';
      confirmBtn.textContent = 'Confirm Payment';
      confirmBtn.addEventListener('click', async ()=>{
        try{
          const paid = await OrderStore.confirmPayment(table);
          if(paid.length) openInvoice(paid, paid[0].paymentMethod);
        }catch(err){ EkCommon.toast(err.message); }
      });

      actions.appendChild(printBtn); actions.appendChild(confirmBtn);
      card.appendChild(head); card.appendChild(itemsList); card.appendChild(totalRow);
      card.appendChild(invoiceLine); card.appendChild(actions);
      host.appendChild(card);
    });
  }

  // invoices is already server-filtered to the current window (last hour, or the
  // selected date) and already one row per invoice — no grouping needed here, unlike
  // the old orders-table version where one bill could span several order rows.
  function renderRecent(invoices){
    const host = document.getElementById('colRecent');
    host.innerHTML = '';
    if(invoices.length===0){
      host.innerHTML = `<p class="kds-empty">${selectedDate ? 'No invoices on this date' : 'No invoices in the last hour'}</p>`;
      return;
    }
    invoices.forEach(inv=>{
      const row = document.createElement('div'); row.className='kds-card recent-card';
      row.innerHTML = `<span class="kds-table">${escapeHtml(EkCommon.tableLabel(inv.table))}</span><span>${EkCommon.money(inv.amount)}</span><span class="method-chip method-${inv.paymentMethod}">${methodLabel(inv.paymentMethod)}</span><span class="order-time">${EkCommon.fmtClock(inv.paidAt)}</span>`;
      row.addEventListener('click', ()=>openInvoiceFromRecord(inv));
      host.appendChild(row);
    });
  }

  function billBreakdownHtml(bill){
    return `
      <div class="bill-line"><span>Subtotal</span><span>${EkCommon.money(bill.subtotal)}</span></div>
      <div class="bill-line"><span>CGST (${bill.halfRate}%)</span><span>${EkCommon.money(bill.cgst)}</span></div>
      <div class="bill-line"><span>SGST (${bill.halfRate}%)</span><span>${EkCommon.money(bill.sgst)}</span></div>
      <div class="bill-total-line"><span>Total</span><span>${EkCommon.money(bill.total)}</span></div>
    `;
  }

  function methodLabel(m){ return { cash:'Cash', card:'Card', upi:'UPI' }[m] || m || '—'; }

  // Live path: a pending bill being previewed pre-payment ("Print Bill") or the
  // just-confirmed result of "Confirm Payment" — sourced from `orders` rows.
  async function openInvoice(orders, method){
    const bill = billFor(orders);
    const isPaid = orders[0].status === 'paid';
    const allItems = [];
    orders.forEach(o=>o.items.forEach(it=>allItems.push(it)));
    await renderInvoiceHtml({
      table: orders[0].table,
      orderRef: orders[0].id,
      invoiceNo: bill.invoiceNo || orders[0].id,
      items: allItems,
      subtotal: bill.subtotal, halfRate: bill.halfRate, cgst: bill.cgst, sgst: bill.sgst, total: bill.total,
      paymentMethod: method,
      // Paid bills show the actual moment payment was confirmed (so reopening an old
      // invoice doesn't relabel it with today's date). A bill only printed pre-payment
      // has no paidAt yet, so "now" is correct there.
      paidAt: isPaid && orders[0].paidAt ? orders[0].paidAt : Date.now(),
      isPaid
    });
  }

  // History path: reopening a past invoice from Recent Invoices — sourced from
  // invoice_log/invoice_items, which is now the only place paid bills live at all.
  // invoice_log only stores the final amount, not the tax breakdown, so the
  // subtotal/CGST/SGST split is reconstructed here from the stored items, with the
  // GST derived as (amount - itemsSubtotal) rather than recomputed from today's GST
  // rate — that way the numbers stay internally consistent with what was actually
  // charged even if the rate constant changes later.
  async function openInvoiceFromRecord(inv){
    const subtotal = inv.items.reduce((s,it)=>s + it.price * it.qty, 0);
    const gst = Math.round((inv.amount - subtotal) * 100) / 100;
    const half = Math.round(gst / 2 * 100) / 100;
    const halfRate = subtotal > 0 ? Math.round((half / subtotal * 100) * 100) / 100 : 0;
    await renderInvoiceHtml({
      table: inv.table,
      orderRef: null,
      invoiceNo: inv.invoiceNo,
      items: inv.items,
      subtotal, halfRate, cgst: half, sgst: half, total: inv.amount,
      paymentMethod: inv.paymentMethod,
      paidAt: inv.paidAt,
      isPaid: true
    });
  }

  // bill: { table, orderRef (nullable), invoiceNo, items, subtotal, halfRate, cgst,
  // sgst, total, paymentMethod, paidAt, isPaid }
  async function renderInvoiceHtml(bill){
    await restaurantReady;
    const area = document.getElementById('invoicePrintArea');
    const r = restaurant || {};
    const regLine = r.gstin ? `GSTIN: ${escapeHtml(r.gstin)}` : '';
    const tableText = escapeHtml(EkCommon.tableLabel(bill.table));
    const orderLine = bill.orderRef ? `Order: ${escapeHtml(bill.orderRef)} · ${tableText}` : tableText;
    area.innerHTML = `
      <div class="invoice-head">
        <div class="invoice-brand">ANGAAR DHABA</div>
        <div class="invoice-addr">${escapeHtml(r.address||'')}</div>
        ${regLine ? `<div class="invoice-reg">${regLine}</div>` : ''}
      </div>
      <div class="invoice-meta invoice-id-row">
        <div>Invoice: <strong>${escapeHtml(bill.invoiceNo)}</strong></div>
        <div>${EkCommon.fmtDateTime(bill.paidAt)}</div>
      </div>
      <div class="invoice-meta">
        <div>${orderLine}</div>
        <div>${methodLabel(bill.paymentMethod)} · ${bill.isPaid ? 'Paid' : 'Unpaid'}</div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          ${bill.items.map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>₹${OrderStore.priceNumber(it.price)}</td><td>₹${OrderStore.itemTotal(it)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="invoice-pay-row">
        <div class="invoice-qr-block">
          <div class="invoice-qr-img" id="invoiceQrHost"></div>
        </div>
        <div class="invoice-totals-block">
          <div class="invoice-meta"><div>Subtotal</div><div>${EkCommon.money(bill.subtotal)}</div></div>
          <div class="invoice-meta"><div>CGST @ ${bill.halfRate}%</div><div>${EkCommon.money(bill.cgst)}</div></div>
          <div class="invoice-meta"><div>SGST @ ${bill.halfRate}%</div><div>${EkCommon.money(bill.sgst)}</div></div>
          <div class="invoice-total-row"><span>Total</span><strong>${EkCommon.money(bill.total)}</strong></div>
        </div>
      </div>
      <div class="invoice-thanks">Thank you for dining with us</div>
      <div class="invoice-footnote">This is a computer-generated invoice · Prices inclusive of applicable taxes</div>
    `;
    document.getElementById('invoiceOverlay').classList.add('show');
    document.getElementById('invoiceOverlay').setAttribute('aria-hidden','false');
    renderInvoiceQr(bill.total, bill.invoiceNo);
  }

  // Builds a upi://pay deep link with the exact bill amount and draws it as a QR code.
  // Hides the QR block (the UPI ID text below still lets staff key it in manually) if the
  // restaurant has no UPI ID set, or the QR library failed to load (e.g. offline).
  function renderInvoiceQr(amount, invoiceNo){
    const host = document.getElementById('invoiceQrHost');
    if(!host) return;
    const r = restaurant || {};
    if(!r.upiId || typeof QRCode === 'undefined'){ host.style.display = 'none'; return; }
    const params = new URLSearchParams({
      pa: r.upiId, pn: r.upiPayeeName || 'Angaar Dhaba',
      am: amount.toFixed(2), cu: 'INR', tn: invoiceNo
    });
    const upiLink = 'upi://pay?' + params.toString();
    try{ new QRCode(host, { text: upiLink, width: 102, height: 102 }); }
    catch(e){ host.style.display = 'none'; }
  }
  function closeInvoice(){
    document.getElementById('invoiceOverlay').classList.remove('show');
    document.getElementById('invoiceOverlay').setAttribute('aria-hidden','true');
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
