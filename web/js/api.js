const API = 'http://localhost:3001';

function getCookie(name) {
  const v = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return v ? decodeURIComponent(v.split('=')[1]) : '';
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // CSRF only for unsafe methods
  if (/^(POST|PUT|PATCH|DELETE)$/i.test(method || 'GET')) {
    headers['x-csrf-token'] = getCookie('csrf');
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });
  if (res.status === 401 && path !== '/auth/refresh') {
    // Try refresh once
    const r = await fetch(API + '/auth/refresh', { method:'POST', credentials:'include', headers: { 'x-csrf-token': getCookie('csrf') } });
    if (r.ok) {
      const retry = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include'
      });
      if (!retry.ok) throw new Error((await safeJson(retry)).error || 'API error');
      return safeJson(retry);
    }
  }
  if (!res.ok) throw new Error((await safeJson(res)).error || 'API error');
  return safeJson(res);
}

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export async function requireAuthOrRedirect() {
  try {
    const { user } = await api('/auth/me');
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch {
    location.replace('./logowanie.html');
  }
}
