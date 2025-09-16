// web/app.js
// Małe utilsy UI + globalny logout przez wrapper API (same-origin przez /api)
const API = '/api';

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

// UI: schowaj domyślnie przyciski, pokaż gdy mamy dostęp (cookie access ustawiane po /guest/access/:token)
function syncAuthUi() {
  const access = getCookie('access');
  const logoutBtn = document.getElementById('logoutBtn');
  const panelLink = document.querySelector('a[href="./panel.html"]');

  if (access) {
    logoutBtn && (logoutBtn.style.display = '');
    panelLink && (panelLink.style.display = '');
  } else {
    logoutBtn && (logoutBtn.style.display = 'none');
    panelLink && (panelLink.style.display = 'none');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  syncAuthUi();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        // CSRF double-submit: cookie 'csrf' ustawia /api/csrf, więc wystarczy go odczytać
        const res = await fetch(API + '/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-csrf-token': getCookie('csrf') }
        });
        // ignorujemy odpowiedź – ważne, że cookie po stronie serwera zniknie
      } catch {}
      localStorage.removeItem('user');
      alert('Wylogowano.');
      location.replace('./index.html');
    });
  }
});
