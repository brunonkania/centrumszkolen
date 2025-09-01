// web/js/home.js
import { _raw, apiFetch } from './api.js';

const el = document.getElementById('api-status');

(async () => {
  try {
    const ping = await _raw('/health');
    if (ping?.ok) el.textContent = 'Połączono z API ✅';
    // pokaż kto jest zalogowany (jeśli jest sesja)
    try {
      const me = await apiFetch('/auth/me');
      if (me?.user?.email) el.textContent = `Zalogowany jako ${me.user.email} ✅`;
    } catch { /* brak sesji to OK */ }
  } catch (e) {
    el.textContent = 'Nie można połączyć z API ❌';
  }
})();
