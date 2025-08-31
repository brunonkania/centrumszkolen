import { api } from './js/api.js';
import { requireAuthOrRedirect, logout } from './js/auth.js';

await requireAuthOrRedirect();

const params = new URLSearchParams(location.search);
const courseId = Number(params.get('id') || 1);

const titleEl = document.getElementById('courseTitle');
const barEl = document.getElementById('progressBar');
const textEl = document.getElementById('progressText');
const modulesEl = document.getElementById('modules');
const msgEl = document.getElementById('msg');
const certBtn = document.getElementById('certBtn');

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await api('/auth/logout', { method:'POST' });
  logout();
  location.replace('./index.html');
});

async function loadCourse() {
  msgEl.textContent = '';
  try {
    const view = await api(`/courses/${courseId}`);
    renderCourse(view);
  } catch (e) {
    if (String(e.message || '').includes('NOT_ENROLLED')) {
      msgEl.innerHTML = 'Nie masz jeszcze dostępu do tego kursu. Przejdź do <a href="./sklep.html">sklepu</a>.';
    } else {
      msgEl.textContent = e.message || 'Nie udało się wczytać kursu.';
    }
  }
}

function renderCourse(view) {
  titleEl.textContent = view.title;
  barEl.style.width = `${view.percent}%`;
  textEl.textContent = `Postęp: ${view.percent}%`;
  certBtn.style.display = view.percent === 100 ? 'inline-block' : 'none';
  certBtn.href = `http://localhost:3001/certificates/${courseId}.pdf`;

  modulesEl.innerHTML = view.modules.map(m => {
    const locked = m.locked ? 'locked' : '';
    const done = m.completed ? 'done' : '';
    const disabled = m.locked ? 'disabled' : '';
    const label = m.locked ? 'Zablokowany' : (m.completed ? 'Zaliczone' : 'Otwórz');
    const href = m.locked ? '#' : `./module.html?course=${courseId}&no=${m.id}`;
    return `
      <a class="card ${locked} ${done}" href="${href}" ${disabled && 'tabindex="-1"'}>
        <h3>${m.id}. ${m.title}</h3>
        <div class="row">
          <button class="btn" ${disabled}>${label}</button>
        </div>
      </a>
    `;
  }).join('');
}

loadCourse();
