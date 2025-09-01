// uruchom: node server/scripts/e2e-smoke.js
const BASE = process.env.BASE || 'http://localhost:3001';
const email = `e2e_${Date.now()}@test.local`;
const password = 'test1234';
const name = 'E2E Test';

function j(x) { return JSON.stringify(x); }

async function main() {
  console.log('[E2E] start');

  // health
  const h = await fetch(`${BASE}/health`);
  console.log('[health]', h.status);

  // register
  const r = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: j({ email, password, name })
  });
  console.log('[register]', r.status);
  const rj = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('register failed: ' + j(rj));

  // login (powinno dać 403 EMAIL_NOT_VERIFIED)
  const l = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: j({ email, password }),
  });
  console.log('[login-before-verify]', l.status);
  const lj = await l.json().catch(() => ({}));
  if (l.status !== 403) console.warn('expected 403 EMAIL_NOT_VERIFIED, got:', l.status, lj);

  // password forgot (powinno być 200 OK)
  const f = await fetch(`${BASE}/auth/password/forgot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: j({ email })
  });
  console.log('[forgot]', f.status);

  console.log('[E2E] done (manual verify e-mail required).');
}

main().catch(e => { console.error(e); process.exit(1); });
