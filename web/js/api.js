// web/js/api.js
// Jeden, spójny punkt dostępu do backendu przez Nginx proxy.
// Dzięki temu nie potrzebujemy CORS w prod/dev – wszystko idzie jako same-origin.
const API_URL = '/api';

async function getCsrf() {
  const r = await fetch(`${API_URL}/csrf`, { credentials: 'include' });
  return r.ok ? (await r.json()).csrf : null;
}

// surowy ping bez CSRF (np. /health)
export async function _raw(path, init) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...(init || {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/**
 * apiFetch – wrapper z CSRF i cookies.
 * - JSON in/out
 * - automatycznie dołącza token z /api/csrf w nagłówku x-csrf-token dla metod modyfikujących
 */
export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
  const csrf = needsCsrf ? (await getCsrf()) : null;

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const err = await res.json(); msg = err.message || err.error || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}
