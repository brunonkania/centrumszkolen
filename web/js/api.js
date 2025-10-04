// Fetch helper z sensowną obsługą błędów (pokazuj message z backendu)
export async function handle(res) {
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok || (json && json.ok === false)) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json ?? { ok: true, data: null };
}

export const api = {
  async get(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    return handle(r);
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body ?? {})
    });
    return handle(r);
  },
  async put(url, body) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body ?? {})
    });
    return handle(r);
  }
};
