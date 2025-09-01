// Małe utilsy UI + globalny logout przez wrapper API
const API = window.__API__ || 'http://localhost:3001';

function getCookie(name) {
  const v = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return v ? decodeURIComponent(v.split('=')[1]) : '';
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Baner cookies – jeśli masz na stronach
  const banner = document.getElementById('cookiesBanner');
  if (banner) {
    const okBtn = banner.querySelector('button[data-accept]');
    okBtn?.addEventListener('click', () => {
      document.cookie = 'cookies_ok=1; path=/; max-age=31536000';
      banner.style.display = 'none';
    });
  }

  // Globalny przycisk „Wyloguj”
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        // korzystamy z fetch bezpośrednio tutaj, ale z pełną obsługą CSRF+cookies
        const res = await fetch(API + '/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-csrf-token': getCookie('csrf') }
        });
        // ignorujemy zwrotkę – ważne, że cookie po stronie serwera zniknie
      } catch {}
      localStorage.removeItem('user');
      alert('Wylogowano.');
      location.replace('./index.html');
    });
  }
});
