// web/js/auth.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

/**
 * Obsługa formularza logowania.
 * options.successRedirect - ścieżka po sukcesie (np. 'kursy.html').
 */
export function initLogin(options = {}) {
  const form = document.getElementById('login-form');
  const msg = document.getElementById('login-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      showToast('Zalogowano ✅');
      window.location.href = options.successRedirect || 'index.html';
    } catch {
      if (msg) msg.textContent = 'Nieprawidłowy e-mail lub hasło';
      showToast('Logowanie nieudane');
    }
  });
}

/**
 * Podpina kliknięcie „Wyloguj” dla elementu #logout-btn lub [data-logout].
 */
export function attachLogout() {
  const el = document.querySelector('#logout-btn, [data-logout]');
  if (!el) return;
  el.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    showToast('Wylogowano');
    window.location.href = 'logowanie.html';
  });
}
