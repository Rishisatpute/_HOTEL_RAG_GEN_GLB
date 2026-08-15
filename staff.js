// Angaar Dhaba — Staff hub bootstrap. A ?token= in the URL (the bookmark
// link handed out to staff, see server-php/config/.env.example) unlocks the
// hub the same way the PIN does, without prompting — falls through to the
// normal PIN gate (staff-login.html) if there's no token, or it's wrong.
(() => {
  document.addEventListener('DOMContentLoaded', async () => {
    const token = EkCommon.qs('token');
    if (token && localStorage.getItem('ek_staff_unlocked') !== 'true') {
      try {
        const res = await fetch(OrderStore.apiBase + '/api/staff_login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          localStorage.setItem('ek_staff_unlocked', 'true');
          history.replaceState(null, '', location.pathname); // scrub the token off the URL bar
        }
      } catch (e) { /* fall through to the normal PIN gate below */ }
    }

    if (!EkCommon.requireStaffAccess()) return;

    document.getElementById('staffLockLink').addEventListener('click', (e) => {
      e.preventDefault();
      EkCommon.staffLogout();
      location.href = 'staff-login.html';
    });
  });
})();
