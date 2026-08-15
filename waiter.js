// Angaar Dhaba — Waiter view.
// Left column: unclaimed active orders restaurant-wide (new/preparing/ready), with
// a "Take this order" claim button — claiming moves an order OFF this list, so two
// waiters can never work the same order. Right column: orders claimed by THIS
// waiter (grouped by table, since payment is requested per table) — edit, mark
// delivered, and a Request Payment control that's always live: clicking it sends
// every order at that table to the counter regardless of kitchen status.
(() => {
  if(!EkCommon.requireStaffAccess()) return; // staff PIN required first

  // Identity now comes from the PIN itself (staff-login.js), not a name picker —
  // ek_waiter_name is per-tab (sessionStorage), so a fresh tab that's already
  // PIN-unlocked overall can still land here without it and needs to re-auth.
  const myName = sessionStorage.getItem('ek_waiter_name');
  if(!myName){ location.replace('staff-login.html?next=waiter.html'); return; }

  let knownActiveIds = new Set();
  let firstRender = true;
  const selectedMethodByTable = {}; // table -> 'cash'|'upi'|'card', persisted across re-renders until requested

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('waiterWelcome').textContent = `Welcome, ${myName}`;
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    // render() already diffs known ids/keys itself to decide when to flash/beep,
    // so onChange just needs to trigger a re-check.
    OrderStore.onChange(() => render());

    document.getElementById('newOrderBtn')?.addEventListener('click', openNewOrderModal);
    document.getElementById('newOrderCancelBtn')?.addEventListener('click', closeNewOrderModal);
    document.getElementById('newOrderConfirmBtn')?.addEventListener('click', confirmNewOrder);
    document.getElementById('newOrderModal')?.addEventListener('click', (e)=>{ if(e.target.id==='newOrderModal') closeNewOrderModal(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNewOrderModal(); });
  });

  // ---------- Take a new order (waiter ordering on behalf of a guest) ----------
  function openNewOrderModal(){
    document.getElementById('waiterTableInput').value = '';
    const modal = document.getElementById('newOrderModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.getElementById('waiterTableInput').focus();
  }
  function closeNewOrderModal(){
    const modal = document.getElementById('newOrderModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }
  function confirmNewOrder(){
    const table = document.getElementById('waiterTableInput').value.trim();
    if(!table){ EkCommon.toast('Enter a table number'); return; }
    const url = `menu.html?table=${encodeURIComponent(table)}&waiter=${encodeURIComponent(myName)}`;
    window.open(url, '_blank');
    closeNewOrderModal();
  }

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }
  function flashActive(){
    EkCommon.alertChime();
    const col = document.getElementById('colActive').closest('.waiter-section');
    col.classList.add('flash'); setTimeout(()=>col.classList.remove('flash'), 1600);
  }

  function methodLabel(m){ return { cash:'Cash', upi:'UPI', card:'Card' }[m] || m; }
  function statusLabel(s){ return { new:'New', preparing:'Preparing', ready:'Ready — deliver now', delivered:'Delivered' }[s] || s; }

  function groupByTable(orders){
    const g = {};
    orders.forEach(o => { (g[o.table] = g[o.table] || []).push(o); });
    return g;
  }

  async function render(){
    let orders;
    // new/preparing/ready feed the left overview; delivered orders (still mine
    // until paid) round out the right "my orders" panel.
    try{ orders = await OrderStore.getByStatuses(['new','preparing','ready','delivered']); }
    catch(err){ return; } // transient network hiccup — the next poll will retry

    // Once an order is claimed it belongs on that waiter's own screen only —
    // it drops out of the shared "active" overview so two waiters can't both
    // work it.
    const active = orders.filter(o => !o.assignedWaiter && (o.status==='new' || o.status==='preparing' || o.status==='ready'))
      .sort((a,b)=>a.createdAt-b.createdAt);
    const mine = orders.filter(o => o.assignedWaiter===myName);

    // Chime whenever a brand-new order needs claiming — there's no more digital
    // "kitchen marked it ready" moment to alert on (no Kitchen Display anymore),
    // so this is the one event left worth a sound.
    if(!firstRender){
      const currentActiveIds = new Set(active.map(o=>o.id));
      let hasNewActive = false;
      currentActiveIds.forEach(id => { if(!knownActiveIds.has(id)) hasNewActive = true; });
      if(hasNewActive) flashActive();
    }
    knownActiveIds = new Set(active.map(o=>o.id));
    firstRender = false;

    renderActive(active);
    renderMine(groupByTable(mine));
  }

  function renderActive(active){
    const host = document.getElementById('colActive');
    document.getElementById('countActive').textContent = active.length;
    host.innerHTML = '';
    if(active.length === 0){ host.innerHTML = '<p class="kds-empty">Nothing active right now</p>'; return; }
    active.forEach(o => {
      const card = document.createElement('div'); card.className = 'kds-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">${escapeHtml(EkCommon.tableLabel(o.table))}</span><span class="kds-age">${statusLabel(o.status)} · ${EkCommon.timeAgoMins(o.createdAt)}m</span>`;
      const items = document.createElement('ul'); items.className = 'kds-items';
      o.items.forEach(it => { const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; items.appendChild(li); });
      card.appendChild(head); card.appendChild(items);

      const btn = document.createElement('button'); btn.className='btn primary sm full-width'; btn.textContent='Take this order';
      btn.addEventListener('click', ()=>OrderStore.updateOrder(o.id, {assignedWaiter: myName}).catch(err=>EkCommon.toast(err.message)));
      card.appendChild(btn);
      host.appendChild(card);
    });
  }

  function renderMine(groups){
    const host = document.getElementById('colMine');
    const tables = Object.keys(groups);
    const orderCount = tables.reduce((n,t)=>n+groups[t].length, 0);
    document.getElementById('countMine').textContent = orderCount;
    host.innerHTML = '';
    if(tables.length === 0){ host.innerHTML = '<p class="kds-empty">You haven\'t taken any orders yet</p>'; return; }

    tables.forEach(table => {
      const tableOrders = groups[table];
      if(!selectedMethodByTable[table]) selectedMethodByTable[table] = 'cash';

      const card = document.createElement('div'); card.className = 'kds-card';
      const head = document.createElement('div'); head.className = 'kds-card-head';
      head.innerHTML = `<span class="kds-table">${escapeHtml(EkCommon.tableLabel(table))}</span>`;
      card.appendChild(head);

      tableOrders.forEach(o => {
        const row = document.createElement('div'); row.className = 'mine-order-row';
        const items = document.createElement('ul'); items.className = 'kds-items';
        o.items.forEach(it => { const li=document.createElement('li'); li.textContent = `${it.qty}× ${it.name}`; items.appendChild(li); });
        row.appendChild(items);

        const rowActions = document.createElement('div'); rowActions.className = 'kds-actions wrap';

        // No Kitchen Display anymore to mark an order "ready" first — the waiter
        // just marks it delivered whenever they've actually walked it to the table.
        if(o.status !== 'delivered'){
          const deliverBtn = document.createElement('button'); deliverBtn.className='btn primary sm'; deliverBtn.textContent='Mark delivered';
          deliverBtn.addEventListener('click', ()=>OrderStore.updateOrder(o.id, {status:'delivered'}).catch(err=>EkCommon.toast(err.message)));
          rowActions.appendChild(deliverBtn);
        }

        const editBtn = document.createElement('button'); editBtn.className='btn outline sm'; editBtn.textContent='Edit';
        editBtn.addEventListener('click', ()=>{
          const url = `menu.html?table=${encodeURIComponent(table)}&waiter=${encodeURIComponent(myName)}&edit=${encodeURIComponent(o.id)}`;
          window.open(url, '_blank');
        });
        rowActions.appendChild(editBtn);

        row.appendChild(rowActions);
        card.appendChild(row);
      });

      const methodRow = document.createElement('div'); methodRow.className = 'kds-actions wrap';
      ['cash','upi','card'].forEach(m => {
        const b = document.createElement('button');
        b.className = 'btn ' + (m===selectedMethodByTable[table] ? 'primary' : 'outline') + ' sm';
        b.textContent = methodLabel(m);
        b.addEventListener('click', ()=>{ selectedMethodByTable[table] = m; render(); });
        methodRow.appendChild(b);
      });
      card.appendChild(methodRow);

      const requestBtn = document.createElement('button');
      requestBtn.className = 'btn full-width primary';
      requestBtn.textContent = 'Request Payment';
      requestBtn.addEventListener('click', ()=>{
        OrderStore.requestBill(table, selectedMethodByTable[table]).catch(err=>EkCommon.toast(err.message));
        delete selectedMethodByTable[table];
      });
      card.appendChild(requestBtn);

      host.appendChild(card);
    });
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
