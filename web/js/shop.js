// web/js/shop.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

/**
 * Podpina przyciski "Kup kurs" (data-buy-course="<id>")
 * i przenosi na stronę płatności.
 */
export function initShop() {
  document.querySelectorAll('[data-buy-course]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const courseId = Number(btn.getAttribute('data-buy-course'));
      btn.disabled = true;
      try {
        const r = await apiFetch('/payments/create', {
          method: 'POST',
          body: JSON.stringify({ course_id: courseId }),
        });
        const order = r.order;
        if (order.status === 'paid') {
          // kurs darmowy lub już masz enrollment
          showToast('Dostęp przyznany ✅');
          window.location.href = `kurs.html?id=${courseId}`;
          return;
        }
        // przejdź do strony płatności
        window.location.href = `platnosc.html?order=${order.id}&course=${courseId}`;
      } catch (e) {
        console.error(e);
        showToast('Nie udało się utworzyć zamówienia (zaloguj się?)');
      } finally {
        btn.disabled = false;
      }
    });
  });
}
