// web/js/api.js
const API_URL = 'http://localhost:3000';

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
  return ct.includes('application/json') ? res.json() : null;
}

export async function apiFetch(path, options = {}) {
  const csrf = await getCsrf().catch(() => null);
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    body: options.body,
    credentials: 'include',
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
