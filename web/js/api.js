const API = window.__API__ || 'http://localhost:3001';

function getCookie(name) {
  const v = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return v ? decodeURIComponent(v.split('=')[1]) : '';
}

export async function api(path, { method = 'GET', body } = {}) {
  const isUnsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(method || 'GET');

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isUnsafe) headers['x-csrf-token'] = getCookie('csrf');

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const err = new Error(
      (data && (data.message || data.error)) ||
      `HTTP ${res.status}`
    );
    if (data && data.error) err.code = data.error;
    err.status = res.status;
    throw err;
  }

  return data === null ? {} : data;
}

export async function health() {
  return api('/health');
}

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export async function requireAuthOrRedirect() {
  try {
    const { user } = await api('/auth/me');
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (e) {
    location.replace('./logowanie.html');
    return null;
  }
}
