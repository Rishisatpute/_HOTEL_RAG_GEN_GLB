// Angaar Dhaba — shows the QR code for each physical table, each linking straight
// to the menu with that table pre-filled AND a secret per-table token (menu.js
// reads both ?table= and ?t= — see setTable()/the token check in orders.php). A
// scan proves the customer is physically at that table; the backend rejects
// order creation if the table+token don't match.
//
// The table list is fixed here on purpose — no UI to grow/shrink it or to
// regenerate codes, since that's exactly what would invalidate whatever's
// already printed and stuck to a table. To add a table, add it to
// TABLE_NUMBERS below; existing tables keep their existing tokens either way
// (ensureTableTokens() never changes a token that already exists).
(() => {
  if(!EkCommon.requireStaffAccess()) return; // redirects to staff-login.html if not verified

  // Hardcoded rather than derived from location.href: these codes get printed
  // and stuck to physical tables, so they must always point at the real site
  // regardless of where this page happens to be opened from (including right
  // now, during local/Docker development).
  const SITE_ORIGIN = 'https://angaardhaba.com';
  const TABLE_NUMBERS = Array.from({ length: 13 }, (_, i) => String(i + 1));

  document.addEventListener('DOMContentLoaded', () => {
    tickClock();
    setInterval(tickClock, 1000 * 30);
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-single'));
    load();
  });

  function tickClock(){
    const el = document.getElementById('staffClock');
    if(el) el.textContent = EkCommon.fmtClock(Date.now());
  }

  function menuUrl(table, token){
    const params = new URLSearchParams({ table });
    if(token) params.set('t', token);
    return `${SITE_ORIGIN}/menu.html?${params.toString()}`;
  }

  // Isolates one card for printing by hiding every other .qr-card via a body-level
  // class, so "Print" on a single table never pulls the rest of the sheet along.
  function printOne(card){
    document.querySelectorAll('.qr-card').forEach(c => c.classList.remove('print-only'));
    card.classList.add('print-only');
    document.body.classList.add('printing-single');
    window.print();
  }

  function addCard(grid, label, url){
    const card = document.createElement('div'); card.className = 'qr-card';
    const labelEl = document.createElement('div'); labelEl.className = 'qr-card-label'; labelEl.textContent = label;
    const host = document.createElement('div'); host.className = 'qr-card-code';
    const hint = document.createElement('div'); hint.className = 'qr-card-hint'; hint.textContent = url;
    const printBtn = document.createElement('button');
    printBtn.className = 'btn outline sm no-print'; printBtn.textContent = 'Print QR';
    printBtn.addEventListener('click', () => printOne(card));
    card.appendChild(labelEl); card.appendChild(host); card.appendChild(hint); card.appendChild(printBtn);
    grid.appendChild(card);
    if(typeof QRCode !== 'undefined'){
      try{ new QRCode(host, { text: url, width: 138, height: 138 }); }
      catch(e){ hint.textContent = 'QR generation failed — ' + url; }
    }
  }

  async function load(){
    const grid = document.getElementById('qrGrid');
    grid.innerHTML = '<p class="kds-empty">Loading tables…</p>';
    let tokenByTable;
    try{
      const rows = await OrderStore.ensureTableTokens(TABLE_NUMBERS);
      tokenByTable = Object.fromEntries(rows.map(r => [r.table, r.token]));
    }catch(err){
      grid.innerHTML = `<p class="kds-empty">Could not reach the backend to fetch tokens — ${err.message}</p>`;
      return;
    }
    grid.innerHTML = '';
    TABLE_NUMBERS.forEach(t => addCard(grid, `Table ${t}`, menuUrl(t, tokenByTable[t])));
    addCard(grid, 'Takeaway', menuUrl('Takeaway')); // exempt from tokens/occupancy entirely
    // Not a table at all — a direct link into the staff PIN gate. Whoever scans
    // it enters their own waiter/counter PIN and lands straight on their console
    // (staff_login.php resolves that); a manager's shared PIN still lands on the hub.
    addCard(grid, 'Staff Login', `${SITE_ORIGIN}/staff-login.html`);
  }
})();
