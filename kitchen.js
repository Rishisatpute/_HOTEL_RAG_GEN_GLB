// Angaar Dhaba — Kitchen Display System
(() => {
  let knownIds = new Set();
  let firstRender = true;

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    // render() already diffs known order ids itself to decide when to flash/beep
    // for something new, so onChange just needs to trigger a re-check — no need
    // to inspect what kind of change it was. This poll (every few seconds) also
    // keeps the elapsed-time colour coding fresh even when nothing else changed.
    OrderStore.onChange(() => render());
  });

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }

  function flashNewOrder(){
    EkCommon.alertChime();
    const col = document.querySelector('.kds-col[data-col="new"]');
    col.classList.add('flash');
    setTimeout(()=>col.classList.remove('flash'), 1600);
  }

  function elapsedClass(ts){
    const mins = EkCommon.timeAgoMins(ts);
    if(mins >= 12) return 'age-critical';
    if(mins >= 6) return 'age-warn';
    return 'age-ok';
  }

  async function render(){
    let orders;
    try{ orders = await OrderStore.getAll(); }
    catch(err){ return; } // transient network hiccup — the 15s interval will retry
    const cols = {
      new: orders.filter(o=>o.status==='new').sort((a,b)=>a.createdAt-b.createdAt),
      preparing: orders.filter(o=>o.status==='preparing').sort((a,b)=>a.createdAt-b.createdAt),
      ready: orders.filter(o=>o.status==='ready').sort((a,b)=>a.createdAt-b.createdAt),
    };

    if(!firstRender){
      const currentIds = new Set(orders.filter(o=>o.status==='new').map(o=>o.id));
      let hasNew = false;
      currentIds.forEach(id=>{ if(!knownIds.has(id)) hasNew = true; });
      if(hasNew) flashNewOrder();
    }
    knownIds = new Set(cols.new.map(o=>o.id));
    firstRender = false;

    renderCol('colNew', cols.new, 'new');
    renderCol('colPreparing', cols.preparing, 'preparing');
    renderCol('colReady', cols.ready, 'ready');
    document.getElementById('countNew').textContent = cols.new.length;
    document.getElementById('countPreparing').textContent = cols.preparing.length;
    document.getElementById('countReady').textContent = cols.ready.length;
  }

  function renderCol(hostId, orders, status){
    const host = document.getElementById(hostId);
    host.innerHTML = '';
    if(orders.length === 0){ host.innerHTML = '<p class="kds-empty">Nothing here</p>'; return; }
    orders.forEach(o=>{
      const card = document.createElement('div'); card.className = 'kds-card ' + elapsedClass(o.createdAt);
      const head = document.createElement('div'); head.className = 'kds-card-head';
      const waiterTag = o.placedBy === 'waiter' ? `<span class="waiter-tag">🧑‍🍳 ${escapeHtml(o.waiterName || 'Waiter')}</span>` : '';
      head.innerHTML = `<span class="kds-table">Table ${escapeHtml(o.table)}</span>${waiterTag}<span class="kds-age">${EkCommon.timeAgoMins(o.createdAt)}m</span>`;
      const items = document.createElement('ul'); items.className = 'kds-items';
      o.items.forEach(it=>{
        const li = document.createElement('li');
        li.textContent = `${it.qty}× ${it.name}`;
        if(it.special) li.classList.add('kds-special');
        items.appendChild(li);
      });
      card.appendChild(head); card.appendChild(items);
      if(o.notes){ const n = document.createElement('div'); n.className='kds-notes'; n.textContent = o.notes; card.appendChild(n); }

      const actions = document.createElement('div'); actions.className='kds-actions';
      if(status === 'new'){
        const btn = document.createElement('button'); btn.className='btn primary sm'; btn.textContent = 'Start preparing';
        btn.addEventListener('click', ()=>OrderStore.updateOrder(o.id, {status:'preparing'}).catch(err=>EkCommon.toast(err.message)));
        actions.appendChild(btn);
      } else if(status === 'preparing'){
        const btn = document.createElement('button'); btn.className='btn primary sm'; btn.textContent = 'Mark ready';
        btn.addEventListener('click', ()=>OrderStore.updateOrder(o.id, {status:'ready'}).catch(err=>EkCommon.toast(err.message)));
        actions.appendChild(btn);
      } else {
        const badge = document.createElement('div'); badge.className='kds-waiting-badge'; badge.textContent = 'Waiting for waiter';
        actions.appendChild(badge);
      }
      card.appendChild(actions);
      host.appendChild(card);
    });
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
