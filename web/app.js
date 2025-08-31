const API = 'http://localhost:3001';

function getCookie(name) {
  const v = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return v ? decodeURIComponent(v.split('=')[1]) : '';
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(()=> t.style.display = 'none', 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json().catch(()=> ({}));
      statusEl.textContent = res.ok
        ? `API OK ✅ ${JSON.stringify(data)}`
        : `API błąd ❌ ${res.status}`;
    } catch (e) {
      statusEl.textContent = 'Brak połączenia z API ❌';
      console.error(e);
    }
  }

  // Cookie banner
  const banner = document.getElementById('cookieBanner');
  const accept = document.getElementById('cookieAccept');
  if (banner && accept) {
    if (!localStorage.getItem('cookie_ok')) banner.style.display = 'flex';
    accept.addEventListener('click', () => {
      localStorage.setItem('cookie_ok', '1');
      banner.style.display = 'none';
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch(API + '/auth/logout', { method:'POST', credentials:'include', headers:{ 'x-csrf-token': getCookie('csrf') } });
      localStorage.removeItem('user');
      alert('Wylogowano.');
      location.replace('./index.html');
    });
  }
});
