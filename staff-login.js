// Angaar Dhaba — staff PIN gate. The PIN itself is only ever checked
// server-side (staff_login.php, against either a personal staff_logins row
// or the shared STAFF_PIN in config/.env) — this page just asks for it and,
// on success, remembers "verified" for this browser so staff aren't
// re-prompted on every page. A personal waiter/counter PIN also carries the
// person's name/role back, which sends them straight to their console
// instead of the staff.html hub.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // Already unlocked (e.g. back button after logging in) — skip straight through.
    // Exception: landing here with ?next=waiter.html means waiter.js sent us here
    // specifically because ek_waiter_name (per-tab, unlike the localStorage unlock
    // flag) is missing — auto-skipping would just bounce straight back to
    // waiter.html and loop. Only skip if that identity is already in place too.
    const next = EkCommon.qs('next') || 'staff.html';
    const needsWaiterIdentity = next.startsWith('waiter.html') && !sessionStorage.getItem('ek_waiter_name');
    if(localStorage.getItem('ek_staff_unlocked') === 'true' && !needsWaiterIdentity){ goNext(); return; }
    document.getElementById('staffLoginForm').addEventListener('submit', onSubmit);
    document.getElementById('staffPinInput').focus();
  });

  function goNext(){
    const next = EkCommon.qs('next') || 'staff.html';
    location.replace(next);
  }

  async function onSubmit(e){
    e.preventDefault();
    const input = document.getElementById('staffPinInput');
    const errorEl = document.getElementById('staffLoginError');
    errorEl.hidden = true;
    const pin = input.value.trim();
    if(!pin) return;
    try{
      const res = await fetch(OrderStore.apiBase + '/api/staff_login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if(!res.ok){
        errorEl.textContent = 'Incorrect PIN — try again';
        errorEl.hidden = false;
        input.value = '';
        input.focus();
        return;
      }
      const data = await res.json();
      localStorage.setItem('ek_staff_unlocked', 'true');
      if(data.role === 'waiter'){
        sessionStorage.setItem('ek_waiter_name', data.name);
        location.replace('waiter.html');
      } else if(data.role === 'counter'){
        location.replace('counter.html');
      } else {
        goNext();
      }
    }catch(err){
      errorEl.textContent = 'Could not reach the server — check your connection and try again';
      errorEl.hidden = false;
    }
  }
})();
