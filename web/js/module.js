// web/js/module.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

const params = new URLSearchParams(location.search);
const courseId = Number(params.get('course') || 0);
const moduleNo = Number(params.get('module') || 0);

const h1 = document.getElementById('h1');
const content = document.getElementById('content');
const back = document.getElementById('back');
const finish = document.getElementById('finish');

back.href = `kurs.html?id=${courseId}`;

async function load() {
  if (!courseId || !moduleNo) {
    h1.textContent = 'Błędny adres';
    return;
  }
  try {
    const r = await apiFetch(`/modules/${courseId}/${moduleNo}`);
    h1.textContent = `${r.module.title} (Moduł ${r.module.module_no})`;
    content.innerHTML = r.module.content_html || '<p>Brak treści.</p>';
    if (r.module.requires_quiz) {
      finish.disabled = true;
      finish.title = 'Ten moduł wymaga zaliczenia quizu';
    }
  } catch (e) {
    content.textContent = 'Nie udało się wczytać modułu.';
  }
}

finish.addEventListener('click', async () => {
  try {
    await apiFetch(`/progress/${courseId}/${moduleNo}/complete`, { method: 'POST' });
    showToast('Moduł ukończony ✅');
    // idź do kolejnego
    window.location.href = `kurs.html?id=${courseId}`;
  } catch (e) {
    showToast('Nie można zakończyć modułu (quiz wymagany?)');
  }
});

load();
