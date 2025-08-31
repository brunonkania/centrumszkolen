import { api } from './api.js';

export async function login(email, password) {
  const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export async function register(name, email, password) {
  return await api('/auth/register', { method: 'POST', body: { name, email, password } });
}

export function logout() {
  localStorage.removeItem('user');
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
