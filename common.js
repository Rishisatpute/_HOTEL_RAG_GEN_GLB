// Shared helpers used across every Angaar Dhaba page (home, menu, kitchen, waiter, counter).
const EkCommon = (() => {
  const WHATSAPP_NUMBER = '917807780724'; // country code + number, digits only

  function whatsappLink(prefillText){
    const base = `https://wa.me/${WHATSAPP_NUMBER}`;
    return prefillText ? `${base}?text=${encodeURIComponent(prefillText)}` : base;
  }

  function money(n){
    const num = typeof n === 'number' ? n : parseFloat(n) || 0;
    return '₹' + num.toLocaleString('en-IN');
  }

  // Menu prices can be "499" or a slash-separated set of options like "399 / 649"
  // (half/full, size variants, etc). Every option gets its own ₹ so "199 / 249"
  // never reads like a fraction or a range.
  function formatMenuPrice(raw){
    if(raw==null) return '';
    const str = String(raw);
    if(!str.includes('/')) return '₹' + str.trim();
    return str.split('/').map(s => '₹' + s.trim()).join(' / ');
  }

  function beep(freq, duration, type){
    freq = freq || 880; duration = duration || 0.15; type = type || 'sine';
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration + 0.05);
      osc.onended = () => ctx.close();
    }catch(e){ /* audio unavailable, fail silently */ }
  }
  function alertChime(){ beep(784,0.12); setTimeout(()=>beep(988,0.16), 150); }

  function toast(msg, ms){
    ms = ms || 2800;
    let host = document.getElementById('ekToastHost');
    if(!host){ host = document.createElement('div'); host.id='ekToastHost'; host.className='toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div'); t.className='toast'; t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, ms);
  }

  function qs(name){ return new URLSearchParams(location.search).get(name); }

  function setHeaderHeightVar(){
    const topbar = document.getElementById('topbar');
    if(!topbar) return;
    document.documentElement.style.setProperty('--header-h', topbar.offsetHeight + 'px');
  }

  function fmtClock(ts){ return new Date(ts).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}); }
  function fmtDateTime(ts){ return new Date(ts).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}); }
  function timeAgoMins(ts){ return Math.max(0, Math.floor((Date.now()-ts)/60000)); }

  function initChrome(){
    // Sticky header height var + hamburger wiring, shared by every page that includes the standard header markup.
    setHeaderHeightVar();
    window.addEventListener('resize', setHeaderHeightVar);
    const hamburger = document.getElementById('hamburger');
    const navDesktop = document.getElementById('navDesktop');
    hamburger && hamburger.addEventListener('click', ()=>{
      const open = navDesktop.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navDesktop && navDesktop.querySelectorAll('.nav-link').forEach(link=>{
      link.addEventListener('click', ()=>{ navDesktop.classList.remove('open'); hamburger && hamburger.setAttribute('aria-expanded','false'); });
    });
  }

  function initFooterExtras(){
    // Footer year + back-to-top button, shared by every page with the standard footer.
    const yearEl = document.getElementById('footerYear');
    if(yearEl) yearEl.textContent = new Date().getFullYear();

    const btn = document.getElementById('backToTop');
    if(btn){
      btn.hidden = false;
      const toggle = () => {
        const show = window.scrollY > window.innerHeight * 0.6;
        btn.classList.toggle('show', show);
      };
      window.addEventListener('scroll', toggle, {passive:true});
      toggle();
      btn.addEventListener('click', ()=>{
        window.scrollTo({top:0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
    }
  }

  return { WHATSAPP_NUMBER, whatsappLink, money, formatMenuPrice, beep, alertChime, toast, qs, setHeaderHeightVar, fmtClock, fmtDateTime, timeAgoMins, initChrome, initFooterExtras };
})();
