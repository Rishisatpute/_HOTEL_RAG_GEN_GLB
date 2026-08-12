// Angaar Dhaba — Waiter view: deliver ready orders, get alerted when a table wants to pay cash.
(() => {
  let knownReadyIds = new Set();
  let knownCashKeys = new Set();
  let firstRender = true;
  const ackCashTables = new Set(); // acknowledged-in-this-tab-session, clears on reload by design
  const selectedMethodByTable = {}; // table -> 'cash'|'upi'|'card', persisted across re-renders until requested

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    // render() already diffs known ready-order/cash-request ids itself to decide
    // when to flash/beep, so onChange just needs to trigger a re-check.
    OrderStore.onChange(() => render());

    document.getElementById('newOrderBtn')?.addEventListener('click', openNewOrderModal);
    document.getElementById('newOrderCancelBtn')?.addEventListener('click', closeNewOrderModal);
    document.getElementById('newOrderConfirmBtn')?.addEventListener('click', confirmNewOrder);
    document.getElementById('newOrderModal')?.addEventListener('click', (e)=>{ if(e.target.id==='newOrderModal') closeNewOrderModal(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNewOrderModal(); });
  });

  // ---------- Take a new order (waiter ordering on behalf of a guest) ----------
  function openNewOrderModal(){
    document.getElementById('waiterNameInput').value = sessionStorage.getItem('ek_waiter_name') || '';
    document.getElementById('waiterTableInput').value = '';
    const modal = document.getElementById('newOrderModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.getElementById('waiterNameInput').focus();
  }
  function closeNewOrderModal(){
    const modal = document.getElementById('newOrderModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }
  function confirmNewOrder(){
    const name = document.getElementById('waiterNameInput').value.trim();
    const table = document.getElementById('waiterTableInput').value.trim();
    if(!name){ EkCommon.toast('Enter your name'); return; }
    if(!table){ EkCommon.toast('Enter a table number'); return; }
    sessionStorage.setItem('ek_waiter_name', name);
    const url = `menu.html?table=${encodeURIComponent(table)}&waiter=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
    closeNewOrderModal();
  }

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }
  function flashReady(){
    EkCommon.alertChime();
    const col = document.querySelector('.waiter-section:not(.cash-section)');
    col.classList.add('flash'); setTimeout(()=>col.classList.remove('flash'), 1600);
  }
  function flashCash(){
    EkCommon.beep(660,0.12); setTimeout(()=>EkCommon.beep(660,0.12),180); setTimeout(()=>EkCommon.beep(880,0.2),360);
    const col = document.querySelector('.cash-section');
    col.classList.add('flash'); setTimeout(()=>col.classList.remove('flash'), 1600);
  }

  async function render(){
    let orders;
    try{ orders = await OrderStore.getAll(); }
    catch(err){ return; } // transient network hiccup — the 15s interval will retry
    const ready = orders.filter(o=>o.status==='ready').sort((a,b)=>a.updatedAt-b.updatedAt);
    const deliveredByTable = {};
    orders.filter(o=>o.status==='delivered')
      .forEach(o=>{ (deliveredByTable[o.table] = deliveredByTable[o.table] || []).push(o); });
    const cashByTable = {};
    orders.filter(o=>o.status==='bill_requested' && o.paymentMethodRequested==='cash' && !ackCashTables.has(o.table))
      .forEach(o=>{ (cashByTable[o.table] = cashByTable[o.table] || []).push(o); });

    if(!firstRender){
      const currentReadyIds = new Set(ready.map(o=>o.id));
      let hasNew = false;
      currentReadyIds.forEach(id=>{ if(!knownReadyIds.has(id)) hasNew = true; });
      if(hasNew) flashReady();
      const currentCashKeys = new Set(Object.keys(cashByTable));
      let hasNewCash = false;
      currentCashKeys.forEach(k=>{ if(!knownCashKeys.has(k)) hasNewCash = true; });
      if(hasNewCash) flashCash();
    }
    knownReadyIds = new Set(ready.map(o=>o.id));
    knownCashKeys = new Set(Object.keys(cashByTable));
    firstRender = false;

    renderReady(ready);
    renderDelivered(deliveredByTable);
    renderCash(cashByTable);
  }

  function renderReady(ready){
    const host = document.getElementById('colReady');
    document.getElementById('countReady').textContent = ready.length;
    host.innerHTML = '';
    if(ready.length === 0){ host.innerHTML = '<p class="kds-empty">Nothing waiting right now</p>'; return; }
    ready.forEach(o=>{
      const card = document.createElement('div'); card.className = 'kds-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(o.table)}</span><span class="kds-age">${EkCommon.timeAgoMins(o.updatedAt)}m ready</span>`;
      const items = document.createElement('ul'); items.className = 'kds-items';
      o.items.forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; items.appendChild(li); });
      const btn = document.createElement('button'); btn.className='btn primary sm'; btn.textContent='Mark delivered';
      btn.addEventListener('click', ()=>OrderStore.updateOrder(o.id, {status:'delivered'}).catch(err=>EkCommon.toast(err.message)));
      card.appendChild(head); card.appendChild(items); card.appendChild(btn);
      host.appendChild(card);
    });
  }

  function methodLabel(m){ return { cash:'Cash', upi:'UPI', card:'Card' }[m] || m; }

  function renderDelivered(deliveredByTable){
    const host = document.getElementById('colDelivered');
    const tables = Object.keys(deliveredByTable);
    document.getElementById('countDelivered').textContent = tables.length;
    host.innerHTML = '';
    if(tables.length === 0){ host.innerHTML = '<p class="kds-empty">Nothing waiting for payment</p>'; return; }
    tables.forEach(table=>{
      const orders = deliveredByTable[table];
      const total = orders.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
      if(!selectedMethodByTable[table]) selectedMethodByTable[table] = 'cash';
      const card = document.createElement('div'); card.className = 'kds-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(table)}</span><span class="kds-age">₹${total}</span>`;
      const items = document.createElement('ul'); items.className = 'kds-items';
      orders.forEach(o=>o.items.forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; items.appendChild(li); }));
      const methodRow = document.createElement('div'); methodRow.className = 'kds-actions wrap';
      ['cash','upi','card'].forEach(m=>{
        const b = document.createElement('button');
        b.className = 'btn ' + (m===selectedMethodByTable[table] ? 'primary' : 'outline') + ' sm';
        b.textContent = methodLabel(m);
        b.addEventListener('click', ()=>{ selectedMethodByTable[table] = m; render(); });
        methodRow.appendChild(b);
      });
      const requestBtn = document.createElement('button');
      requestBtn.className = 'btn primary sm full-width'; requestBtn.textContent = 'Payment Requested';
      requestBtn.addEventListener('click', ()=>{
        OrderStore.requestBill(table, selectedMethodByTable[table]).catch(err=>EkCommon.toast(err.message));
        delete selectedMethodByTable[table];
      });
      card.appendChild(head); card.appendChild(items); card.appendChild(methodRow); card.appendChild(requestBtn);
      host.appendChild(card);
    });
  }

  function renderCash(cashByTable){
    const host = document.getElementById('colCash');
    const tables = Object.keys(cashByTable);
    document.getElementById('countCash').textContent = tables.length;
    host.innerHTML = '';
    if(tables.length === 0){ host.innerHTML = '<p class="kds-empty">No cash pickups pending</p>'; return; }
    tables.forEach(table=>{
      const orders = cashByTable[table];
      const total = orders.reduce((s,o)=>s+OrderStore.orderTotal(o),0);
      const card = document.createElement('div'); card.className = 'kds-card cash-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(table)}</span><span class="kds-age">₹${total}</span>`;
      const note = document.createElement('div'); note.className='kds-notes'; note.textContent = 'Customer wants to pay CASH — take the bill to the table.';
      const btn = document.createElement('button'); btn.className='btn outline sm'; btn.textContent='Got it — heading there';
      btn.addEventListener('click', ()=>{ ackCashTables.add(table); render(); });
      card.appendChild(head); card.appendChild(note); card.appendChild(btn);
      host.appendChild(card);
    });
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
