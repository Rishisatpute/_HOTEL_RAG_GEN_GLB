// Ek Punjab — Counter: confirm payment, generate & print invoices.
(() => {
  let restaurant = null;
  let knownBillKeys = new Set();
  let firstRender = true;
  let selectedDate = null; // 'YYYY-MM-DD', or null for the default "last hour" view
  // Invoices (GSTIN/FSSAI lines, UPI QR) need restaurant data from menu-data.json. On a slow
  // connection that fetch can still be in flight when staff click "Print Bill" — openInvoice()
  // awaits this promise so the invoice never silently renders without it.
  const restaurantReady = fetch('menu-data.json?v=11').then(r=>r.json()).then(data=>{ restaurant = data.restaurant; }).catch(()=>{});

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    OrderStore.onChange((msg)=>{ if(msg.type === 'bill_requested') flashPending(); render(); });
    setInterval(render, 15000);
    document.getElementById('closeInvoiceBtn').addEventListener('click', closeInvoice);
    document.getElementById('printInvoiceBtn').addEventListener('click', ()=>window.print());
    document.getElementById('invoiceOverlay').addEventListener('click', (e)=>{ if(e.target.id==='invoiceOverlay') closeInvoice(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeInvoice(); });
    document.getElementById('invoiceDateFilter').addEventListener('change', (e)=>{
      selectedDate = e.target.value || null;
      render();
    });
    document.getElementById('clearDateFilterBtn').addEventListener('click', ()=>{
      selectedDate = null;
      document.getElementById('invoiceDateFilter').value = '';
      render();
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

  function render(){
    const orders = OrderStore.getAll();
    const pending = orders.filter(o=>o.status==='bill_requested');
    const pendingGroups = groupByTable(pending);

    if(!firstRender){
      const currentKeys = new Set(Object.keys(pendingGroups));
      let hasNew = false;
      currentKeys.forEach(k=>{ if(!knownBillKeys.has(k)) hasNew = true; });
      if(hasNew) flashPending();
    }
    knownBillKeys = new Set(Object.keys(pendingGroups));
    firstRender = false;

    renderPending(pendingGroups);
    renderRecent(orders.filter(o=>o.status==='paid'));
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
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(table)}</span>${waiterTag}<span class="method-chip method-${method}">${methodLabel(method)}</span>`;
      const itemsList = document.createElement('ul'); itemsList.className='kds-items';
      ordersForTable.forEach(o=>o.items.forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; itemsList.appendChild(li); }));
      const totalRow = document.createElement('div'); totalRow.className='bill-breakdown'; totalRow.innerHTML = billBreakdownHtml(bill);
      const invoiceLine = document.createElement('div'); invoiceLine.className = 'kds-notes';
      invoiceLine.innerHTML = bill.invoiceNo ? `Invoice: <strong>${escapeHtml(bill.invoiceNo)}</strong>` : 'Invoice not generated yet';
      const actions = document.createElement('div'); actions.className='kds-actions wrap';

      const genBtn = document.createElement('button'); genBtn.className = 'btn outline sm';
      genBtn.textContent = bill.invoiceNo ? 'Invoice Generated' : 'Generate Invoice';
      genBtn.disabled = !!bill.invoiceNo;
      genBtn.addEventListener('click', ()=>{ OrderStore.generateInvoice(table); render(); });

      const printBtn = document.createElement('button'); printBtn.className = 'btn outline sm';
      printBtn.textContent = 'Print Bill';
      printBtn.addEventListener('click', ()=>{
        const generated = OrderStore.generateInvoice(table); // no-op if already generated
        if(generated.length) openInvoice(generated, method);
      });

      const confirmBtn = document.createElement('button'); confirmBtn.className = 'btn primary sm';
      confirmBtn.textContent = 'Confirm Payment';
      confirmBtn.addEventListener('click', ()=>{
        const paid = OrderStore.confirmPayment(table);
        if(paid.length) openInvoice(paid, paid[0].paymentMethod);
      });

      actions.appendChild(genBtn); actions.appendChild(printBtn); actions.appendChild(confirmBtn);
      card.appendChild(head); card.appendChild(itemsList); card.appendChild(totalRow);
      card.appendChild(invoiceLine); card.appendChild(actions);
      host.appendChild(card);
    });
  }

  // Default view: invoices paid in the last hour. Picking a date in the filter switches to
  // browsing that whole calendar day instead; "Last hour" resets back to the default.
  function filterPaidOrders(paidOrders){
    if(selectedDate){
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      return paidOrders.filter(o=>o.paidAt >= dayStart && o.paidAt < dayEnd);
    }
    const cutoff = Date.now() - 60 * 60 * 1000;
    return paidOrders.filter(o=>o.paidAt >= cutoff);
  }

  function renderRecent(paidOrders){
    const host = document.getElementById('colRecent');
    host.innerHTML = '';
    const filtered = filterPaidOrders(paidOrders);
    const groups = {};
    filtered.forEach(o=>{ const k = o.table + '::' + o.paidAt; (groups[k]=groups[k]||[]).push(o); });
    const keys = Object.keys(groups).sort((a,b)=>groups[b][0].paidAt - groups[a][0].paidAt);
    if(keys.length===0){
      host.innerHTML = `<p class="kds-empty">${selectedDate ? 'No invoices on this date' : 'No invoices in the last hour'}</p>`;
      return;
    }
    keys.forEach(k=>{
      const grp = groups[k];
      const bill = billFor(grp);
      const row = document.createElement('div'); row.className='kds-card recent-card';
      row.innerHTML = `<span class="kds-table">Table ${escapeHtml(grp[0].table)}</span><span>${EkCommon.money(bill.total)}</span><span class="method-chip method-${grp[0].paymentMethod}">${methodLabel(grp[0].paymentMethod)}</span><span class="order-time">${EkCommon.fmtClock(grp[0].paidAt)}</span>`;
      row.addEventListener('click', ()=>openInvoice(grp, grp[0].paymentMethod));
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

  async function openInvoice(orders, method){
    await restaurantReady;
    const area = document.getElementById('invoicePrintArea');
    const table = orders[0].table;
    const orderRef = orders[0].id;
    const bill = billFor(orders);
    const invoiceNo = bill.invoiceNo || orderRef;
    const isPaid = orders[0].status === 'paid';
    const allItems = [];
    orders.forEach(o=>o.items.forEach(it=>allItems.push(it)));
    const r = restaurant || {};
    const regLine = [
      r.gstin ? `GSTIN: ${escapeHtml(r.gstin)}` : '',
      r.fssai ? `FSSAI: ${escapeHtml(r.fssai)}` : ''
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    area.innerHTML = `
      <div class="invoice-head">
        <div class="invoice-brand">EK PUNJAB</div>
        <div class="invoice-sub">${escapeHtml((r.tagline || 'Royal Chill Bar & Dhaba').toUpperCase())}</div>
        <div class="invoice-addr">${escapeHtml(r.address||'')}</div>
        ${regLine ? `<div class="invoice-reg">${regLine}</div>` : ''}
      </div>
      <div class="invoice-meta">
        <div>Invoice: <strong>${escapeHtml(invoiceNo)}</strong></div>
        <div>${EkCommon.fmtDateTime(Date.now())}</div>
      </div>
      <div class="invoice-meta">
        <div>Order: ${escapeHtml(orderRef)} · Table ${escapeHtml(table)}</div>
        <div>${methodLabel(method)} · ${isPaid ? 'Paid' : 'Unpaid'}</div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          ${allItems.map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>₹${OrderStore.priceNumber(it.price)}</td><td>₹${OrderStore.itemTotal(it)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="invoice-pay-row">
        <div class="invoice-qr-block">
          <div class="invoice-qr-label">SCAN &amp; PAY</div>
          <div class="invoice-qr-img" id="invoiceQrHost"></div>
          <div class="invoice-upi-id">${escapeHtml(r.upiId||'')}</div>
          <div class="invoice-upi-name">${escapeHtml(r.upiPayeeName||'')}</div>
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
    renderInvoiceQr(bill.total, invoiceNo);
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
      pa: r.upiId, pn: r.upiPayeeName || 'Ek Punjab',
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
