// Angaar Dhaba — Sales Dashboard: daily/weekly/monthly revenue trends and top-selling dishes.
// Reads the same live order data as Counter/Kitchen/Waiter (via OrderStore), just aggregates
// the paid ones instead of managing the pending-bill workflow.
(() => {
  let latestPaidOrders = []; // cached from the last render(), so the dish-range toggle can re-slice without refetching
  let dishRangeDays = 7; // 1 = today, 7, 30, 0 = all time

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    render();
    OrderStore.onChange(() => render());
    document.getElementById('dishRangeToggle').addEventListener('click', (e)=>{
      const btn = e.target.closest('.range-btn');
      if(!btn) return;
      document.querySelectorAll('#dishRangeToggle .range-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      dishRangeDays = Number(btn.dataset.range);
      renderDishRank(latestPaidOrders, dishRangeDays); // cached data — no need to refetch for a range switch
    });
  });

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }

  async function render(){
    let orders;
    try{ orders = await OrderStore.getAll(); }
    catch(err){ return; } // transient network hiccup — the next poll tick will retry
    latestPaidOrders = orders.filter(o=>o.status==='paid' && o.paidAt!=null);
    renderDashboard(latestPaidOrders);

    // Kept separate from the orders fetch above — a hiccup fetching visit logs
    // shouldn't stop the sales figures (which just did fetch fine) from rendering.
    try{
      const visits = await OrderStore.getVisits();
      renderPieChart('visitsPie', 'visitsLegend', visitStatsByPage(visits), 'No visits recorded yet');
    }catch(err){ /* leave last known state on screen */ }
  }

  // A paid order with no billTotal recorded (shouldn't normally happen — confirm_payment.php
  // always generates the invoice first) falls back to summing its own items live.
  function billTotalFor(order){
    if(order.billTotal != null) return order.billTotal;
    return OrderStore.billBreakdown(OrderStore.orderTotal(order)).total;
  }

  // Every paid order row carries the FULL bill total (billing_flow.php writes the same
  // bill_total onto every order sharing a table+paidAt bill, so a table with two separate
  // orders merged into one bill has that bill's total duplicated on both rows). Revenue
  // must therefore be summed per *bill* (grouped by table+paidAt), never per order row,
  // or a multi-order bill would get counted twice.
  function startOfDay(ts){ const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }

  function billsFromPaidOrders(paidOrders){
    const groups = {};
    paidOrders.forEach(o=>{ const k = o.table + '::' + o.paidAt; (groups[k] = groups[k] || []).push(o); });
    return Object.values(groups).map(grp=>({ paidAt: grp[0].paidAt, revenue: billTotalFor(grp[0]) }));
  }

  // Oldest-to-newest array of { dayStart, revenue, orders } for the last `days` days
  // (today included as the last entry), so today/week/month tiles and the trend chart
  // can all slice off the same series instead of re-scanning the bill list each time.
  function dailySeries(bills, days){
    const today = startOfDay(Date.now());
    const buckets = [];
    const byStart = new Map();
    for(let i = days - 1; i >= 0; i--){
      const b = { dayStart: today - i * 86400000, revenue: 0, orders: 0 };
      buckets.push(b); byStart.set(b.dayStart, b);
    }
    bills.forEach(bill=>{
      const bucket = byStart.get(startOfDay(bill.paidAt));
      if(bucket){ bucket.revenue += bill.revenue; bucket.orders += 1; }
    });
    return buckets;
  }

  function sumSeries(series){
    return series.reduce((acc,b)=>({ revenue: acc.revenue + b.revenue, orders: acc.orders + b.orders }), { revenue: 0, orders: 0 });
  }

  function setStat(prefix, stat){
    document.getElementById(`stat${prefix}Revenue`).textContent = EkCommon.money(stat.revenue);
    document.getElementById(`stat${prefix}Orders`).textContent = `${stat.orders} bill${stat.orders===1?'':'s'}`;
  }

  function renderDashboard(paidOrders){
    const bills = billsFromPaidOrders(paidOrders);
    const series30 = dailySeries(bills, 30);

    setStat('Today', series30[series30.length - 1]);
    setStat('Week', sumSeries(series30.slice(-7)));
    setStat('Month', sumSeries(series30));

    renderTrendChart(series30.slice(-14));
    renderDishRank(paidOrders, dishRangeDays);
    renderPieChart('paymentPie', 'paymentLegend', paymentMethodStats(paidOrders), 'No paid bills yet');
  }

  function renderTrendChart(series){
    const host = document.getElementById('trendChart');
    host.innerHTML = '';
    if(series.every(b=>b.revenue===0)){ host.innerHTML = '<p class="trend-empty">No sales in the last 14 days yet</p>'; return; }
    const max = Math.max(1, ...series.map(b=>b.revenue));
    const todayStart = startOfDay(Date.now());
    series.forEach(b=>{
      const bar = document.createElement('div'); bar.className = 'trend-bar' + (b.dayStart===todayStart ? ' is-today' : '');
      const fill = document.createElement('div'); fill.className = 'trend-bar-fill';
      fill.style.height = (b.revenue > 0 ? Math.max(4, Math.round(b.revenue / max * 100)) : 1) + '%';
      fill.title = `${EkCommon.fmtDateTime(b.dayStart)} · ${EkCommon.money(b.revenue)} · ${b.orders} bill${b.orders===1?'':'s'}`;
      const label = document.createElement('div'); label.className = 'trend-bar-label';
      label.textContent = new Date(b.dayStart).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      bar.appendChild(fill); bar.appendChild(label);
      host.appendChild(bar);
    });
  }

  // Dish counts come straight off each order row's own items (never duplicated across a
  // multi-order bill the way bill totals are), so this can sum across raw paid orders.
  function dishStats(paidOrders, rangeDays){
    const cutoff = rangeDays > 0 ? startOfDay(Date.now()) - (rangeDays - 1) * 86400000 : -Infinity;
    const map = new Map();
    paidOrders.forEach(o=>{
      if(o.paidAt < cutoff) return;
      o.items.forEach(it=>{
        const cur = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.qty || 1;
        cur.revenue += OrderStore.itemTotal(it);
        map.set(it.name, cur);
      });
    });
    return Array.from(map.values()).sort((a,b)=>b.qty - a.qty).slice(0, 8);
  }

  function renderDishRank(paidOrders, rangeDays){
    const host = document.getElementById('dishRankList');
    const stats = dishStats(paidOrders, rangeDays);
    host.innerHTML = '';
    if(!stats.length){ host.innerHTML = '<p class="kds-empty">No sales in this period yet</p>'; return; }
    const maxQty = stats[0].qty;
    stats.forEach((d,i)=>{
      const li = document.createElement('li'); li.className = 'dish-rank-item';
      const pct = Math.max(4, Math.round(d.qty / maxQty * 100));
      li.innerHTML = `
        <span class="dish-rank-badge">#${i+1}</span>
        <div class="dish-rank-body">
          <div class="dish-rank-top"><span class="dish-rank-name">${escapeHtml(d.name)}</span><span class="dish-rank-qty">${d.qty} sold</span></div>
          <div class="dish-rank-bar-track"><div class="dish-rank-bar-fill" style="width:${pct}%"></div></div>
          <div class="dish-rank-revenue">${EkCommon.money(d.revenue)} revenue</div>
        </div>`;
      host.appendChild(li);
    });
  }

  // ---------- Pie charts ----------
  const PAYMENT_LABELS = { cash: 'Cash', card: 'Card', upi: 'UPI' };

  // One count per *bill* (first order row of each table+paidAt group), same reasoning
  // as billsFromPaidOrders above — a multi-order bill shares one payment method, so
  // counting every row would over-count it.
  function paymentMethodStats(paidOrders){
    const cutoff = startOfDay(Date.now()) - 29 * 86400000;
    const seenBills = new Set();
    const counts = {};
    paidOrders.forEach(o=>{
      if(o.paidAt < cutoff) return;
      const k = o.table + '::' + o.paidAt;
      if(seenBills.has(k)) return;
      seenBills.add(k);
      const method = o.paymentMethod || 'other';
      counts[method] = (counts[method] || 0) + 1;
    });
    return Object.keys(counts).map(k=>({ label: PAYMENT_LABELS[k] || k, value: counts[k] }));
  }

  function visitStatsByPage(visits){
    const cutoff = startOfDay(Date.now()) - 29 * 86400000;
    const counts = { home: 0, menu: 0 };
    visits.forEach(v=>{
      if(v.createdAt < cutoff) return;
      if(v.page in counts) counts[v.page]++;
    });
    return [
      { label: 'Home page', value: counts.home },
      { label: 'Menu page', value: counts.menu },
    ];
  }

  const PIE_PALETTE = ['var(--gold)', 'var(--st-preparing)', 'var(--veg)', 'var(--nonveg)', 'var(--egg)'];

  function renderPieChart(pieId, legendId, items, emptyText){
    const pie = document.getElementById(pieId);
    const legend = document.getElementById(legendId);
    const total = items.reduce((s,it)=>s + it.value, 0);
    legend.innerHTML = '';
    if(total <= 0){
      pie.style.background = 'rgba(255,255,255,0.06)';
      legend.innerHTML = `<p class="pie-empty">${emptyText}</p>`;
      return;
    }
    let cursor = 0;
    const stops = [];
    items.filter(it=>it.value > 0).forEach((it,i)=>{
      const color = PIE_PALETTE[i % PIE_PALETTE.length];
      const pct = it.value / total * 100;
      stops.push(`${color} ${cursor}% ${cursor + pct}%`);
      cursor += pct;
      const li = document.createElement('li');
      li.innerHTML = `<span class="pie-swatch" style="background:${color}"></span><span class="pie-legend-label">${escapeHtml(it.label)}</span><span class="pie-legend-value">${it.value}</span><span class="pie-legend-pct">${pct.toFixed(0)}%</span>`;
      legend.appendChild(li);
    });
    pie.style.background = `conic-gradient(${stops.join(', ')})`;
  }

  function escapeHtml(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
})();
