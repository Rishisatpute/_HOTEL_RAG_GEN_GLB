// Ek Punjab — home page: hero reveal, popular picks, gallery, lightbox.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    EkCommon.initChrome();
    fetch('menu-data.json?v=7').then(r => r.json()).then(data => {
      initSite(data);
    }).catch(err => console.error('menu load', err));
  });

  function initSite(data){
    document.title = `${data.restaurant.name} – ${data.restaurant.tagline}`;
    const wa = document.getElementById('waHeaderLink');
    if(wa) wa.href = EkCommon.whatsappLink(`Hi Ek Punjab! I'd like to ask about...`);
    const waVisit = document.getElementById('waVisitLink');
    if(waVisit) waVisit.href = EkCommon.whatsappLink(`Hi Ek Punjab! I'd like to make a reservation.`);
    const waFooter = document.getElementById('waFooterLink');
    if(waFooter) waFooter.href = EkCommon.whatsappLink(`Hi Ek Punjab! I'd like to ask about...`);

    const zomato = data.restaurant.order?.zomato || '#';
    const swig = data.restaurant.order?.swiggy || '#';
    document.querySelectorAll('#zomatoBtn, #zomatoBtn2').forEach(a=>{ a.href = zomato; });
    document.querySelectorAll('#swiggyBtn, #swiggyBtn2').forEach(a=>{ a.href = swig; });

    renderFooterNotes(data.restaurant.notes || []);
    renderPopular(data.categories || []);
    renderGallery();
    setupHeroReveal();
    setupScrollReveal();
    EkCommon.initFooterExtras();
  }

  function renderFooterNotes(notes){
    const el = document.getElementById('footerNotes');
    if(!el) return; el.innerHTML = '';
    notes.forEach(n=>{ const d=document.createElement('div'); d.textContent=n; el.appendChild(d); });
  }

  function renderPopular(categories){
    const grid = document.getElementById('popularGrid');
    if(!grid) return;
    const specials = [];
    categories.forEach(cat=>cat.items.forEach(item=>{ if(item.special) specials.push(item); }));
    const picks = specials.slice(0, 6);
    grid.innerHTML = '';
    picks.forEach(item=>{
      const card = document.createElement('div'); card.className='popular-card';
      const ind = document.createElement('span'); ind.className='indicator '+(item.type||'veg'); ind.setAttribute('aria-hidden','true');
      const body = document.createElement('div'); body.className='popular-card-body';
      const name = document.createElement('div'); name.className='popular-card-name'; name.textContent=item.name;
      const desc = document.createElement('div'); desc.className='popular-card-desc'; desc.textContent = item.desc || '';
      const price = document.createElement('div'); price.className='popular-card-price'; price.textContent = EkCommon.formatMenuPrice(item.price);
      body.appendChild(name); if(item.desc) body.appendChild(desc); body.appendChild(price);
      card.appendChild(ind); card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function renderGallery(){
    const grid = document.getElementById('galleryGrid'); if(!grid) return;
    for(let i=1;i<=12;i++){
      const name = `ambiance-${String(i).padStart(2,'0')}.jpg`;
      const img = document.createElement('img'); img.loading='lazy'; img.alt=`Ambiance ${i}`;
      img.src = `images/${name}`;
      img.addEventListener('error', ()=>{
        const ph = document.createElement('div'); ph.className='img-placeholder'; ph.style.height='160px'; ph.style.background='linear-gradient(135deg, rgba(0,0,0,0.15), rgba(0,0,0,0.05))'; ph.style.borderRadius='8px'; ph.textContent = name; ph.style.display='flex'; ph.style.alignItems='center'; ph.style.justifyContent='center'; grid.replaceChild(ph,img);
      });
      img.addEventListener('click', ()=>openLightbox(img.src, img.alt));
      grid.appendChild(img);
    }
  }

  function openLightbox(src, alt){
    const lb=document.getElementById('lightbox'); lb.innerHTML='';
    const img=document.createElement('img'); img.src=src; img.alt=alt; img.loading='eager';
    img.addEventListener('error', ()=>{lb.innerHTML='<div style="color:var(--cream)">Image not available</div>'});
    lb.appendChild(img); lb.classList.add('show'); lb.setAttribute('aria-hidden','false');
    lb.addEventListener('click', closeLightbox, {once:true});
    document.addEventListener('keydown', escCloseLightbox);
  }
  function escCloseLightbox(e){ if(e.key==='Escape') closeLightbox(); }
  function closeLightbox(){
    const lb=document.getElementById('lightbox'); lb.classList.remove('show'); lb.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', escCloseLightbox);
  }

  function setupHeroReveal(){
    const el = document.querySelector('[data-animate]'); if(!el) return;
    const io = new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting){ el.style.opacity=1; el.style.transform='translateY(0)'; io.disconnect(); } }) },{threshold:0.2});
    el.style.opacity=0; el.style.transform='translateY(10px)'; io.observe(el);
  }

  function setupScrollReveal(){
    const targets = document.querySelectorAll('.vibe, .popular, .gallery, .visit, .site-footer');
    const io = new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('revealed'); io.unobserve(e.target); } });
    }, {threshold:0.12});
    targets.forEach(t=>{ t.classList.add('reveal-init'); io.observe(t); });
  }
})();
