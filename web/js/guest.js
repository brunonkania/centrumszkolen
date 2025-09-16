// web/js/guest.js
const API = window.API || 'http://localhost:3000';

function getParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name) || '';
}

async function main() {
  const el = document.getElementById('status');
  const token = getParam('token');
  if (!token) {
    el.textContent = 'Brak tokenu w linku.';
    return;
  }
  try {
    const r = await fetch(`${API}/guest/access/${encodeURIComponent(token)}`, {
      credentials: 'include'
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data?.error || 'Nie udało się aktywować linku.');
    el.textContent = 'Dostęp przyznany. Przekierowuję do kursu…';
    const id = data.course_id;
    // przejdź prosto do kursu (Twoja strona kursu obsługuje ?id=)
    window.location.replace(`./kurs.html?id=${id}`);
  } catch (e) {
    console.error(e);
    el.textContent = 'Nie udało się przyznać dostępu. Link może być nieprawidłowy.';
  }
}

document.addEventListener('DOMContentLoaded', main);
