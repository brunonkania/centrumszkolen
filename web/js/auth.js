import { api } from './api.js';

export async function login(email, password) {
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (e) {
    throw e;
  }
}

export async function register(name, email, password) {
  const res = await api('/auth/register', { method: 'POST', body: { name, email, password } });
  return res;
}

export async function resendVerification(email) {
  await api('/auth/verify/resend', { method: 'POST', body: { email } });
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('user');
  }
}

export async function refresh() {
  try { await api('/auth/refresh', { method: 'POST' }); } catch {}
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
    return null;
  }
}
