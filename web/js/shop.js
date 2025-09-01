import { api } from './api.js';
import { requireAuthOrRedirect } from './api.js';

async function init() {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  const courseId = Number(new URLSearchParams(location.search).get('course') || 1);
  const msg = document.getElementById('msg');
  const payBtn = document.getElementById('payBtn');

  payBtn?.addEventListener('click', async () => {
    msg.textContent = 'Tworzę zamówienie...';
    try {
      const res = await api('/payments/create', { method: 'POST', body: { courseId } });
      if (res.redirectUrl) {
        location.href = res.redirectUrl;
      } else {
        msg.textContent = 'Zamówienie utworzone, oczekuję na płatność...';
      }
    } catch (e) {
      if (e.code === 'PAYMENTS_DISABLED') {
        msg.textContent = 'Płatności chwilowo wyłączone. Zapisaliśmy Twoje zamówienie – wróć tu wkrótce. 👍';
      } else if (e.code === 'ALREADY_ENROLLED') {
        msg.textContent = 'Masz już dostęp do kursu. Przekierowuję do panelu...';
        setTimeout(() => location.replace('./panel.html'), 800);
      } else {
        msg.textContent = e.message || 'Nie udało się utworzyć zamówienia.';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
