// Ek Punjab — ordering page: menu render, filters, cart, table, place order, request bill.
(() => {
  const state = {
    restaurant: null,
    categories: [],
    cart: [], // { key, name, price(number), qty, type, special }
    table: sessionStorage.getItem('ek_table') || null,
  };

  document.addEventListener('DOMContentLoaded', () => {
    EkCommon.initChrome();
    fetch('menu-data.json?v=7').then(r => r.json()).then(data => {
      state.restaurant = data.restaurant;
      state.categories = data.categories || [];
      initPage(data);
    }).catch(err => console.error('menu load', err));
    attachStaticUI();
  });

  function initPage(data){
    document.title = `Order Menu – ${data.restaurant.name} · ${data.restaurant.tagline}`;
    EkCommon.setHeaderHeightVar();
    const wa = document.getElementById('waHeaderLink');
    if(wa) wa.href = EkCommon.whatsappLink(`Hi Ek Punjab! I'd like to ask about...`);
    const zomato = data.restaurant.order?.zomato || '#';
    const swig = data.restaurant.order?.swiggy || '#';
    const zb = document.getElementById('zomatoBtn'); if(zb) zb.href = zomato;
    const sb = document.getElementById('swiggyBtn'); if(sb) sb.href = swig;
    renderFooterNotes(data.restaurant.notes || []);
    renderMenu(state.categories);
    setupSearchAndFilters();
    setupCategoryRail();
    renderTableBar();
    renderCart();
    subscribeToOrderChanges();
    EkCommon.initFooterExtras();
  }

  function renderFooterNotes(notes){
    const el = document.getElementById('footerNotes');
    if(!el) return; el.innerHTML = '';
    notes.forEach(n=>{ const d=document.createElement('div'); d.textContent=n; el.appendChild(d); });
  }

  // ---------- Menu rendering ----------
  function renderMenu(categories){
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    categories.forEach((cat, idx)=>{
      const sec = document.createElement('section');
      sec.className='category'; sec.id=`cat-${idx}`;
      const h = document.createElement('h3'); h.textContent = cat.name; sec.appendChild(h);
      cat.items.forEach(item=>{
        sec.appendChild(renderItemCard(item));
      });
      container.appendChild(sec);
    });
  }

  function renderItemCard(item){
    const photo = typeof DISH_PHOTOS !== 'undefined' ? DISH_PHOTOS[item.name] : null;
    const it = document.createElement('div'); it.className = photo ? 'item has-photo' : 'item';
    const left = document.createElement('div'); left.className='item-left';
    const ind = document.createElement('span'); ind.className='indicator '+(item.type||'veg'); ind.setAttribute('aria-hidden','true');
    const meta = document.createElement('div');
    const name = document.createElement('div'); name.className='item-name'; name.textContent=item.name;
    if(item.special){ const badge=document.createElement('span'); badge.className='item-badge'; badge.textContent='★ Chef Special'; name.appendChild(badge); }
    meta.appendChild(name);
    if(item.desc){ const d=document.createElement('div'); d.className='item-desc'; d.textContent=item.desc; meta.appendChild(d); }
    left.appendChild(ind); left.appendChild(meta);

    if(photo){
      // Zomato-style layout: thumbnail with a floating ADD on the right; the price
      // lives on the ADD control itself rather than as separate text. Falls back to
      // the classic text-only card if the file 404s.
      const thumbWrap = document.createElement('div'); thumbWrap.className='item-thumb-wrap';
      const img = document.createElement('img'); img.className='item-thumb'; img.src=photo; img.alt=item.name; img.loading='lazy'; img.decoding='async';
      img.addEventListener('error', ()=>{
        // No usable photo after all — collapse back to the standard text-only card.
        it.classList.remove('has-photo');
        thumbWrap.remove();
        const right = document.createElement('div'); right.className='item-right';
        const addWrap = document.createElement('div'); addWrap.className='add-wrap';
        right.appendChild(addWrap);
        renderAddControl(addWrap, item);
        it.appendChild(right);
      });
      thumbWrap.appendChild(img);
      const addWrap = document.createElement('div'); addWrap.className='add-wrap thumb-add';
      thumbWrap.appendChild(addWrap);
      renderAddControl(addWrap, item);

      it.appendChild(left); it.appendChild(thumbWrap);
      return it;
    }

    const right = document.createElement('div'); right.className='item-right';
    const addWrap = document.createElement('div'); addWrap.className='add-wrap';
    right.appendChild(addWrap);
    renderAddControl(addWrap, item);

    it.appendChild(left); it.appendChild(right);
    return it;
  }

  // A cart "line key" identifies a specific item+chosen-variant so repeat ADDs increment qty.
  function cartKey(name, price){ return name + '::' + price; }
  function findCartLine(key){ return state.cart.find(l=>l.key===key); }
  function variantName(item, v){ return v.fullName ? v.fullName : (v.label ? `${item.name} — ${v.label}` : item.name); }

  // Maps a cart line key -> a function that repaints whichever on-page control(s) represent it,
  // so quantity changes made from the cart drawer stay in sync with the item card without
  // re-rendering the entire (288-item) menu on every click.
  const controlRepaint = new Map();

  function renderAddControl(container, item){
    container.innerHTML = '';
    const variants = parsePriceVariants(item);
    if(variants.length === 1){
      const variant = variants[0];
      const key = cartKey(variantName(item, variant), variant.price);
      const repaint = () => paintSingleControl(container, item, variant, key);
      controlRepaint.set(key, repaint);
      repaint();
    } else {
      const repaint = () => paintMultiControl(container, item, variants);
      variants.forEach(v=>{ controlRepaint.set(cartKey(variantName(item, v), v.price), repaint); });
      repaint();
    }
  }

  function paintSingleControl(container, item, variant, key){
    container.innerHTML = '';
    const line = findCartLine(key);
    if(line && line.qty > 0){
      container.appendChild(buildStepperForKey(key));
    } else {
      const btn = document.createElement('button'); btn.className='add-btn';
      btn.innerHTML = `<span class="add-label">ADD</span><span class="add-price">${EkCommon.money(variant.price)}</span>`;
      btn.addEventListener('click', ()=>{ addToCart(item, variant); });
      container.appendChild(btn);
    }
  }

  function buildStepperForKey(key){
    const wrap = document.createElement('div'); wrap.className='stepper';
    const minus = document.createElement('button'); minus.textContent='−'; minus.setAttribute('aria-label','Remove one');
    const qtyEl = document.createElement('span'); qtyEl.className='stepper-qty';
    const plus = document.createElement('button'); plus.textContent='+'; plus.setAttribute('aria-label','Add one');
    qtyEl.textContent = findCartLine(key)?.qty || 0;
    minus.addEventListener('click', ()=>changeQty(key, -1));
    plus.addEventListener('click', ()=>changeQty(key, 1));
    wrap.appendChild(minus); wrap.appendChild(qtyEl); wrap.appendChild(plus);
    return wrap;
  }

  function paintMultiControl(container, item, variants){
    container.innerHTML = '';
    const btn = document.createElement('button'); btn.className='add-btn';
    const lowest = Math.min(...variants.map(v=>v.price));
    btn.innerHTML = `<span class="add-label">ADD</span><span class="add-price">from ${EkCommon.money(lowest)}</span>`;
    btn.addEventListener('click', (e)=>{ openVariantPopover(e.currentTarget, item, variants); });
    container.appendChild(btn);
    const totalQty = variants.reduce((s,v)=>{
      const line = findCartLine(cartKey(variantName(item, v), v.price));
      return s + (line ? line.qty : 0);
    }, 0);
    if(totalQty > 0){
      const badge = document.createElement('span'); badge.className='in-cart-badge'; badge.textContent = `${totalQty} in cart`;
      container.appendChild(badge);
    }
  }


  function parsePriceVariants(item){
    const priceStr = String(item.price);
    if(!priceStr.includes('/')) return [{ label:null, price: OrderStore.priceNumber(item.price) }];
    const priceParts = priceStr.split('/').map(s=>s.trim());
    // Case 1: trailing parenthetical labels, e.g. "Roti (Plain / Butter)" -> "39 / 49"
    const parenMatch = item.name.match(/\(([^)]+)\)\s*$/);
    if(parenMatch){
      const labelParts = parenMatch[1].split('/').map(s=>s.trim());
      if(labelParts.length === priceParts.length){
        return labelParts.map((label,i)=>({ label, price: parseFloat(priceParts[i])||0 }));
      }
    }
    // Case 2: whole name is slash-separated distinct dishes, e.g. "Masala Peanuts / Green Peas Fry"
    const nameParts = item.name.split('/').map(s=>s.trim());
    if(nameParts.length === priceParts.length && nameParts.length > 1){
      return nameParts.map((label,i)=>({ label, price: parseFloat(priceParts[i])||0, fullName: label }));
    }
    // Fallback: unlabeled price options
    return priceParts.map(p=>({ label: '₹'+p.trim(), price: parseFloat(p)||0 }));
  }

  function openVariantPopover(anchorEl, item, variants){
    const pop = document.getElementById('variantPopover');
    pop.innerHTML = '';
    const title = document.createElement('div'); title.className='variant-title'; title.textContent = 'Choose an option';
    pop.appendChild(title);
    variants.forEach(v=>{
      const b = document.createElement('button'); b.className='variant-opt';
      const labelText = v.fullName ? v.fullName : (v.label || '');
      b.innerHTML = `<span>${labelText}</span><strong>₹${v.price}</strong>`;
      b.addEventListener('click', ()=>{
        addToCart(item, v);
        closeVariantPopover();
      });
      pop.appendChild(b);
    });
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    let left = window.scrollX + r.right - 220;
    if(left < 8) left = 8;
    pop.style.left = left + 'px';
    pop.classList.add('show');
    pop.setAttribute('aria-hidden','false');
    setTimeout(()=>document.addEventListener('click', onDocClickCloseVariant), 0);
  }
  function onDocClickCloseVariant(e){
    const pop = document.getElementById('variantPopover');
    if(!pop.contains(e.target)) closeVariantPopover();
  }
  function closeVariantPopover(){
    const pop = document.getElementById('variantPopover');
    pop.classList.remove('show'); pop.setAttribute('aria-hidden','true');
    document.removeEventListener('click', onDocClickCloseVariant);
  }

  function addToCart(item, variant){
    const name = variantName(item, variant);
    const key = cartKey(name, variant.price);
    let line = findCartLine(key);
    if(line){ line.qty += 1; }
    else { state.cart.push({ key, name, price: variant.price, qty: 1, type: item.type, special: !!item.special }); }
    renderCart();
    const repaint = controlRepaint.get(key); if(repaint) repaint();
    EkCommon.toast(`Added ${name}`, 1400);
  }

  function changeQty(key, delta){
    const line = findCartLine(key);
    if(!line) return;
    line.qty += delta;
    if(line.qty <= 0) state.cart = state.cart.filter(l=>l.key!==key);
    renderCart();
    const repaint = controlRepaint.get(key); if(repaint) repaint();
  }

  // ---------- Cart drawer ----------
  function attachStaticUI(){
    document.getElementById('cartBtn')?.addEventListener('click', openCart);
    document.getElementById('closeCart')?.addEventListener('click', closeCart);
    document.getElementById('cartScrim')?.addEventListener('click', closeCart);
    document.getElementById('placeOrderBtn')?.addEventListener('click', placeOrder);
    document.getElementById('tableChangeBtn')?.addEventListener('click', openTableModal);
    document.getElementById('tableConfirmBtn')?.addEventListener('click', confirmTable);
    document.getElementById('takeawayBtn')?.addEventListener('click', ()=>{ setTable('Takeaway'); closeTableModal(); });
    document.querySelectorAll('.pay-method').forEach(btn=>{
      btn.addEventListener('click', ()=>requestBill(btn.dataset.method));
    });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ closeCart(); closeTableModal(); closeVariantPopover(); } });

    const urlTable = EkCommon.qs('table');
    if(urlTable){ setTable(urlTable, {silent:true}); }
  }

  function openCart(){ document.getElementById('cartDrawer').classList.add('open'); document.getElementById('cartScrim').classList.add('show'); document.getElementById('cartDrawer').setAttribute('aria-hidden','false'); }
  function closeCart(){ document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('cartScrim').classList.remove('show'); document.getElementById('cartDrawer').setAttribute('aria-hidden','true'); }

  function renderCart(){
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const btnText = document.getElementById('cartBtnText');
    const placeBtn = document.getElementById('placeOrderBtn');
    itemsEl.innerHTML = '';
    let total = 0, count = 0;
    if(state.cart.length === 0){
      itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty — tap ADD on a dish to start.</p>';
    }
    state.cart.forEach(line=>{
      total += line.price * line.qty; count += line.qty;
      const row = document.createElement('div'); row.className='cart-line';
      const l = document.createElement('div'); l.className='cart-line-name'; l.textContent = line.name;
      const r = document.createElement('div'); r.className='cart-line-right';
      const stepper = document.createElement('div'); stepper.className='stepper sm';
      const minus = document.createElement('button'); minus.textContent='−';
      const qty = document.createElement('span'); qty.className='stepper-qty'; qty.textContent = line.qty;
      const plus = document.createElement('button'); plus.textContent='+';
      minus.addEventListener('click', ()=>changeQty(line.key,-1));
      plus.addEventListener('click', ()=>changeQty(line.key,1));
      stepper.appendChild(minus); stepper.appendChild(qty); stepper.appendChild(plus);
      const price = document.createElement('div'); price.className='cart-line-price'; price.textContent = EkCommon.money(line.price*line.qty);
      r.appendChild(stepper); r.appendChild(price);
      row.appendChild(l); row.appendChild(r);
      itemsEl.appendChild(row);
    });
    totalEl.textContent = EkCommon.money(total);
    btnText.textContent = count > 0 ? `Cart · ${count}` : 'Cart';
    placeBtn.disabled = state.cart.length === 0 || !state.table;
    placeBtn.textContent = !state.table ? 'Set your table to order' : 'Place order';
    renderMyOrders();
  }

  // ---------- Table ----------
  function renderTableBar(){
    const label = document.getElementById('tableBarLabel');
    const changeBtn = document.getElementById('tableChangeBtn');
    if(state.table){
      label.textContent = `🍽️ Table ${state.table}`;
      changeBtn.textContent = 'Change';
      document.getElementById('cartTableTag').textContent = `· Table ${state.table}`;
    } else {
      label.textContent = '🍽️ Choose your table to start ordering';
      changeBtn.textContent = 'Set table';
      document.getElementById('cartTableTag').textContent = '';
    }
  }
  function openTableModal(){ document.getElementById('tableModal').classList.add('show'); document.getElementById('tableModal').setAttribute('aria-hidden','false'); document.getElementById('tableInput').focus(); }
  function closeTableModal(){ document.getElementById('tableModal').classList.remove('show'); document.getElementById('tableModal').setAttribute('aria-hidden','true'); }
  function confirmTable(){
    const v = document.getElementById('tableInput').value.trim();
    if(!v){ EkCommon.toast('Enter a table number, or choose Takeaway'); return; }
    setTable(v);
    closeTableModal();
  }
  function setTable(t, opts){
    state.table = String(t);
    sessionStorage.setItem('ek_table', state.table);
    renderTableBar();
    renderCart();
    if(!opts || !opts.silent) EkCommon.toast(`Table set to ${state.table}`, 1600);
  }

  // ---------- Place order / bill ----------
  function placeOrder(){
    if(!state.table){ openTableModal(); return; }
    if(state.cart.length === 0) return;
    const order = OrderStore.createOrder({ table: state.table, items: state.cart.map(l=>({name:l.name, price:l.price, qty:l.qty, special:l.special})) });
    state.cart = [];
    renderCart();
    controlRepaint.forEach(fn=>fn());
    closeCart();
    EkCommon.toast(`Order placed for Table ${state.table} — the kitchen has been notified 👨‍🍳`, 3200);
  }

  function requestBill(method){
    if(!state.table) return;
    const orders = OrderStore.requestBill(state.table, method);
    if(orders.length === 0){ EkCommon.toast('No active order to bill yet.'); return; }
    const methodLabel = { upi:'UPI', card:'Card', cash:'Cash' }[method] || method;
    let msg = `Bill requested (${methodLabel}) — the counter has been notified.`;
    if(method === 'cash') msg = `Cash payment requested — a waiter is on the way to your table with the bill.`;
    EkCommon.toast(msg, 3600);
    renderMyOrders();
  }

  function subscribeToOrderChanges(){
    OrderStore.onChange(()=>{ renderMyOrders(); });
  }

  function statusMeta(status){
    return {
      new: { label:'Order received', cls:'st-new' },
      preparing: { label:'Being prepared', cls:'st-preparing' },
      ready: { label:'Ready — waiter notified', cls:'st-ready' },
      delivered: { label:'Delivered to your table', cls:'st-delivered' },
      bill_requested: { label:'Bill requested', cls:'st-bill' },
      paid: { label:'Paid — thank you!', cls:'st-paid' },
    }[status] || { label:status, cls:'' };
  }

  function renderMyOrders(){
    const host = document.getElementById('myOrders');
    const billBox = document.getElementById('billRequest');
    if(!state.table){ host.innerHTML=''; billBox.hidden = true; return; }
    const orders = OrderStore.getByTable(state.table).sort((a,b)=>b.createdAt-a.createdAt);
    if(orders.length === 0){ host.innerHTML=''; billBox.hidden = true; return; }
    host.innerHTML = '<h4 class="my-orders-title">Your orders — Table ' + state.table + '</h4>';
    orders.forEach(o=>{
      const meta = statusMeta(o.status);
      const card = document.createElement('div'); card.className='order-card';
      const head = document.createElement('div'); head.className='order-card-head';
      head.innerHTML = `<span class="status-pill ${meta.cls}">${meta.label}</span><span class="order-time">${EkCommon.fmtClock(o.createdAt)}</span>`;
      const items = document.createElement('div'); items.className='order-card-items';
      items.textContent = o.items.map(it=>`${it.qty}× ${it.name}`).join(', ');
      const total = document.createElement('div'); total.className='order-card-total'; total.textContent = EkCommon.money(OrderStore.orderTotal(o));
      card.appendChild(head); card.appendChild(items); card.appendChild(total);
      host.appendChild(card);
    });
    // Show "Ready to pay?" whenever this table has an order that hasn't been billed yet.
    // A bill already pending for an earlier round (status bill_requested) must NOT hide
    // this for a later round ordered afterwards — each round gets its own bill request.
    const hasUnbilled = orders.some(o=>OrderStore.ACTIVE_STATUSES.includes(o.status));
    const hasPendingBill = orders.some(o=>o.status==='bill_requested');
    billBox.hidden = !hasUnbilled;
    const note = billBox.querySelector('.bill-request-note');
    if(note) note.remove();
    if(!billBox.hidden && hasPendingBill){
      const n = document.createElement('p'); n.className = 'bill-request-note';
      n.textContent = "You've already asked to pay for an earlier round — this is for the new items only.";
      billBox.querySelector('p').after(n);
    }
  }

  // ---------- Search / filter / category rail (same behaviour as before) ----------
  function setupSearchAndFilters(){
    const search = document.getElementById('menuSearch');
    const chips = Array.from(document.querySelectorAll('.chip'));
    search.addEventListener('input', applyFilters);
    chips.forEach(c=>c.addEventListener('click', ()=>{ c.classList.toggle('active'); applyFilters(); }));
  }
  function applyFilters(){
    const search = document.getElementById('menuSearch');
    if(!search) return;
    const q = search.value.toLowerCase().trim();
    const activeTypes = Array.from(document.querySelectorAll('.chip.active')).map(c=>c.dataset.type);
    const categories = document.querySelectorAll('#categoriesContainer .category');
    categories.forEach(cat => {
      const items = Array.from(cat.querySelectorAll('.item'));
      let anyVisible=false;
      items.forEach(it=>{
        const name = it.querySelector('.item-name').textContent.toLowerCase();
        const typeClass = Array.from(it.querySelector('.indicator').classList).find(cl=>['veg','nonveg','egg'].includes(cl)) || 'veg';
        const matchesQuery = !q || name.includes(q);
        const matchesType = activeTypes.length===0 || activeTypes.includes(typeClass);
        const show = matchesQuery && matchesType;
        it.style.display = show? 'flex':'none';
        if(show) anyVisible=true;
      });
      cat.style.display = anyVisible? 'block':'none';
    });
  }
  function setupCategoryRail(){
    const rail = document.getElementById('categoryRail'); if(!rail) return;
    rail.innerHTML = '';
    const cats = Array.from(document.querySelectorAll('#categoriesContainer .category'));
    cats.forEach((c,idx)=>{
      const name = c.querySelector('h3')?.textContent||`Cat ${idx+1}`;
      const b = document.createElement('div'); b.className='cat'; b.innerHTML=`<span>${name}</span><span class="count">${c.querySelectorAll('.item').length}</span>`;
      b.addEventListener('click', ()=>{ document.getElementById(c.id).scrollIntoView({behavior:'smooth',block:'start'}); });
      rail.appendChild(b);
    });
    const menuFilterBar = document.getElementById('menuFilterBar');
    const existingRow = menuFilterBar.querySelector('.mobile-cat-row');
    if(existingRow) existingRow.remove();
    if(menuFilterBar){
      const mrow = document.createElement('div'); mrow.className='mobile-cat-row';
      cats.forEach((c)=>{ const btn=document.createElement('button'); btn.className='mchip'; btn.textContent = c.querySelector('h3').textContent; btn.addEventListener('click', ()=>{ document.getElementById(c.id).scrollIntoView({behavior:'smooth',block:'start'}); }); mrow.appendChild(btn); });
      menuFilterBar.appendChild(mrow);
    }
    const io = new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          const id = e.target.id; Array.from(rail.children).forEach(ch=>ch.classList.remove('active'));
          const idx = cats.findIndex(x=>x.id===id); if(idx>=0) rail.children[idx].classList.add('active');
        }
      });
    },{root:null,rootMargin:'-120px 0px -60% 0px',threshold:0.2});
    cats.forEach(c=>io.observe(c));
  }
})();
