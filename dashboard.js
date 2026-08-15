// Angaar Dhaba — Sales Dashboard: daily/weekly/monthly revenue trends and top-selling dishes.
// Reads from invoice_log/invoice_items (via OrderStore.getInvoices) — the durable paid-bill
// record — never orders/order_items, which confirm_payment.php empties out the moment a bill
// is paid (see billing_flow.php: paid orders are snapshotted into invoices, then deleted).
(() => {
  if(!EkCommon.requireStaffAccess()) return; // staff PIN required first

  let latest30Invoices = []; // last 30 days — covers every tile/chart except the "All time" dish filter
  let allTimeInvoices = null; // fetched lazily, only once "All time" is actually selected
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
      renderDishRank(dishRangeDays);
    });
  });

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }

  function startOfDay(ts){ const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }

  async function render(){
    let invoices;
    try{
      const from = startOfDay(Date.now()) - 29 * 86400000; // last 30 days, covers every tile/chart below
      invoices = await OrderStore.getInvoices(from, Date.now());
    }catch(err){ return; } // transient network hiccup — the next poll tick will retry
    latest30Invoices = invoices;
    renderDashboard(invoices);
  }

  // Oldest-to-newest array of { dayStart, revenue, orders } for the last `days` days
  // (today included as the last entry). invoices.php already returns one row per bill
  // (amount is the bill's actual total, not per-order-line), so this can sum directly —
  // no grouping/dedup needed the way raw order rows would require.
  function dailySeries(invoices, days){
    const today = startOfDay(Date.now());
    const buckets = [];
    const byStart = new Map();
    for(let i = days - 1; i >= 0; i--){
      const b = { dayStart: today - i * 86400000, revenue: 0, orders: 0 };
      buckets.push(b); byStart.set(b.dayStart, b);
    }
    invoices.forEach(inv=>{
      const bucket = byStart.get(startOfDay(inv.paidAt));
      if(bucket){ bucket.revenue += inv.amount; bucket.orders += 1; }
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

  function renderDashboard(invoices){
    const series30 = dailySeries(invoices, 30);

    setStat('Today', series30[series30.length - 1]);
    setStat('Week', sumSeries(series30.slice(-7)));
    setStat('Month', sumSeries(series30));

    renderTrendChart(series30.slice(-14));
    renderDishRank(dishRangeDays);
    renderPieChart('paymentPie', 'paymentLegend', paymentMethodStats(invoices), 'No paid bills yet');
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

  // Dish counts come straight off each invoice's itemized lines.
  function dishStats(invoices, rangeDays){
    const cutoff = rangeDays > 0 ? startOfDay(Date.now()) - (rangeDays - 1) * 86400000 : -Infinity;
    const map = new Map();
    invoices.forEach(inv=>{
      if(inv.paidAt < cutoff) return;
      inv.items.forEach(it=>{
        const cur = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.qty || 1;
        cur.revenue += OrderStore.itemTotal(it);
        map.set(it.name, cur);
      });
    });
    return Array.from(map.values()).sort((a,b)=>b.qty - a.qty).slice(0, 8);
  }

  // "All time" needs a separate, unbounded fetch — the cached 30-day set doesn't cover it.
  // Only fetched while that range is actually selected (not on every poll tick regardless),
  // but does refresh each time this is called so it stays live while it's the active view.
  async function renderDishRank(rangeDays){
    const host = document.getElementById('dishRankList');
    let source = latest30Invoices;
    if(rangeDays === 0){
      try{ allTimeInvoices = await OrderStore.getInvoices(); }
      catch(err){
        if(!allTimeInvoices){ host.innerHTML = '<p class="kds-empty">Could not load all-time sales</p>'; return; }
      }
      source = allTimeInvoices;
    }

    const stats = dishStats(source, rangeDays);
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

  // ---------- Pie chart ----------
  const PAYMENT_LABELS = { cash: 'Cash', card: 'Card', upi: 'UPI' };

  function paymentMethodStats(invoices){
    const counts = {};
    invoices.forEach(inv=>{
      const method = inv.paymentMethod || 'other';
      counts[method] = (counts[method] || 0) + 1;
    });
    return Object.keys(counts).map(k=>({ label: PAYMENT_LABELS[k] || k, value: counts[k] }));
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
