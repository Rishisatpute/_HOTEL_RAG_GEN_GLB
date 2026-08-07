// Ek Punjab — Counter: confirm payment, generate & print invoices.
(() => {
  let restaurant = null;
  let knownBillKeys = new Set();
  let firstRender = true;

  document.addEventListener('DOMContentLoaded', () => {
    fetch('menu-data.json?v=7').then(r=>r.json()).then(data=>{ restaurant = data.restaurant; }).catch(()=>{});
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    OrderStore.onChange((msg)=>{ if(msg.type === 'bill_requested') flashPending(); render(); });
    setInterval(render, 15000);
    document.getElementById('closeInvoiceBtn').addEventListener('click', closeInvoice);
    document.getElementById('printInvoiceBtn').addEventListener('click', ()=>window.print());
    document.getElementById('invoiceOverlay').addEventListener('click', (e)=>{ if(e.target.id==='invoiceOverlay') closeInvoice(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeInvoice(); });
  });

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
      const total = ordersForTable.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
      const method = ordersForTable[0].paymentMethodRequested;
      const waiterOrder = ordersForTable.find(o=>o.placedBy==='waiter');
      const waiterTag = waiterOrder ? `<span class="waiter-tag">🧑‍🍳 ${escapeHtml(waiterOrder.waiterName || 'Waiter')}</span>` : '';
      const card = document.createElement('div'); card.className = 'kds-card bill-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(table)}</span>${waiterTag}<span class="method-chip method-${method}">${methodLabel(method)}</span>`;
      const itemsList = document.createElement('ul'); itemsList.className='kds-items';
      ordersForTable.forEach(o=>o.items.forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; itemsList.appendChild(li); }));
      const totalRow = document.createElement('div'); totalRow.className='kds-notes'; totalRow.innerHTML = `<strong>${EkCommon.money(total)}</strong>`;
      const actions = document.createElement('div'); actions.className='kds-actions wrap';
      ['cash','card','upi'].forEach(m=>{
        const b = document.createElement('button');
        b.className = 'btn ' + (m===method ? 'primary' : 'outline') + ' sm';
        b.textContent = 'Confirm ' + methodLabel(m);
        b.addEventListener('click', ()=>{
          const paid = OrderStore.markPaid(table, m);
          if(paid.length) openInvoice(paid, m);
        });
        actions.appendChild(b);
      });
      card.appendChild(head); card.appendChild(itemsList); card.appendChild(totalRow); card.appendChild(actions);
      host.appendChild(card);
    });
  }

  function renderRecent(paidOrders){
    const host = document.getElementById('colRecent');
    host.innerHTML = '';
    const groups = {};
    paidOrders.forEach(o=>{ const k = o.table + '::' + o.paidAt; (groups[k]=groups[k]||[]).push(o); });
    const keys = Object.keys(groups).sort((a,b)=>groups[b][0].paidAt - groups[a][0].paidAt).slice(0,12);
    if(keys.length===0){ host.innerHTML = '<p class="kds-empty">No invoices yet</p>'; return; }
    keys.forEach(k=>{
      const grp = groups[k];
      const total = grp.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
      const row = document.createElement('div'); row.className='kds-card recent-card';
      row.innerHTML = `<span class="kds-table">Table ${escapeHtml(grp[0].table)}</span><span>${EkCommon.money(total)}</span><span class="method-chip method-${grp[0].paymentMethod}">${methodLabel(grp[0].paymentMethod)}</span><span class="order-time">${EkCommon.fmtClock(grp[0].paidAt)}</span>`;
      row.addEventListener('click', ()=>openInvoice(grp, grp[0].paymentMethod));
      host.appendChild(row);
    });
  }

  function methodLabel(m){ return { cash:'Cash', card:'Card', upi:'UPI' }[m] || m || '—'; }

  function openInvoice(orders, method){
    const area = document.getElementById('invoicePrintArea');
    const table = orders[0].table;
    const total = orders.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
    const allItems = [];
    orders.forEach(o=>o.items.forEach(it=>allItems.push(it)));
    const r = restaurant || {};
    area.innerHTML = `
      <div class="invoice-head">
        <div class="invoice-brand">EK PUNJAB</div>
        <div class="invoice-sub">Royal Chill Bar & Dhaba</div>
        <div class="invoice-addr">${escapeHtml(r.address||'')}</div>
        <div class="invoice-addr">${(r.phones||[]).join(' · ')}</div>
      </div>
      <div class="invoice-meta">
        <div>Table <strong>${escapeHtml(table)}</strong></div>
        <div>${EkCommon.fmtDateTime(Date.now())}</div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
        <tbody>
          ${allItems.map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>₹${OrderStore.priceNumber(it.price)}</td><td>₹${OrderStore.itemTotal(it)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="invoice-total-row"><span>Total</span><strong>${EkCommon.money(total)}</strong></div>
      <div class="invoice-meta"><div>Paid via <strong>${methodLabel(method)}</strong></div></div>
      <div class="invoice-thanks">Thank you for dining with us!</div>
    `;
    document.getElementById('invoiceOverlay').classList.add('show');
    document.getElementById('invoiceOverlay').setAttribute('aria-hidden','false');
  }
  function closeInvoice(){
    document.getElementById('invoiceOverlay').classList.remove('show');
    document.getElementById('invoiceOverlay').setAttribute('aria-hidden','true');
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
