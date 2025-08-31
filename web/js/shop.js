import { api } from './js/api.js';
import { requireAuthOrRedirect } from './js/auth.js';

await requireAuthOrRedirect();

const catalogEl = document.getElementById('catalog');
const msgEl = document.getElementById('msg');

async function loadCatalog() {
  try {
    const list = await api('/catalog');
    catalogEl.innerHTML = list.map(item => `
      <div class="card">
        <h3>${item.title}</h3>
        <p class="muted">Cena: ${item.price.toFixed(2)} zł</p>
        ${item.enrolled
          ? '<p class="muted">Masz dostęp ✅</p>'
          : `<p class="muted">Płatności w kolejnym etapie.</p>`}
      </div>
    `).join('');
  } catch (e) {
    msgEl.textContent = e.message || 'Nie udało się wczytać katalogu.';
  }
}

loadCatalog();
