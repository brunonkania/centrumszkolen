// web/js/shop.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

let guestEmail = localStorage.getItem('guestEmail') || '';

async function loadCatalog() {
  const wrap = document.getElementById('catalog');
  wrap.innerHTML = '<div class="card skeleton" style="height:96px;"></div>';

  try {
    const res = await fetch((window.API || '') + '/catalog', { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { courses } = await res.json();

    wrap.innerHTML = '';
    courses.forEach((c) => {
      const price = (c.price_cents || 0) / 100;
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <div class="row">
          <div>
            <h3 style="margin:0">${c.title}</h3>
            <p class="muted" style="margin-top:4px">${c.description || ''}</p>
          </div>
          <div style="text-align:right">
            <div class="price" style="font-size:18px;font-weight:600">${price.toFixed(2)} zł</div>
            <button class="btn buyBtn" data-course-id="${c.id}" style="margin-top:8px">Kup teraz</button>
          </div>
        </div>
      `;
      wrap.appendChild(el);
    });

    document.querySelectorAll('.buyBtn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const courseId = Number(btn.getAttribute('data-course-id'));
        if (!guestEmail) {
          showToast('Podaj najpierw swój e-mail (góra strony).');
          document.getElementById('guestEmail')?.focus();
          return;
        }
        btn.disabled = true;
        try {
          const r = await apiFetch('/guest/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: guestEmail, course_id: courseId })
          });
          if (!r.ok) throw new Error('Checkout failed');
          showToast('Link do kursu wysłany na e-mail. Sprawdź skrzynkę 📬');
        } catch (e) {
          console.error(e);
          showToast('Nie udało się utworzyć zamówienia.');
        } finally {
          btn.disabled = false;
        }
      });
    });

  } catch (e) {
    console.error(e);
    wrap.innerHTML = '<div class="card"><p>Nie udało się załadować katalogu.</p></div>';
  }
}

function initEmailForm() {
  const input = document.getElementById('guestEmail');
  const msg = document.getElementById('emailMsg');
  const btn = document.getElementById('saveEmailBtn');

  if (guestEmail && input) {
    input.value = guestEmail;
    msg.textContent = `Użyjemy e-maila: ${guestEmail}`;
  }

  btn?.addEventListener('click', () => {
    const v = input.value.trim();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(v)) {
      msg.textContent = 'Podaj poprawny adres e-mail.';
      return;
    }
    guestEmail = v;
    localStorage.setItem('guestEmail', v);
    msg.textContent = `Użyjemy e-maila: ${guestEmail}`;
    showToast('Zapisano e-mail.');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEmailForm();
  loadCatalog();
});
