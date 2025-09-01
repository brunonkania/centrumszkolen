// web/js/course.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

const params = new URLSearchParams(location.search);
const courseId = Number(params.get('id') || 0);
const titleEl = document.getElementById('title');
const listEl = document.getElementById('mods');

async function load() {
  if (!courseId) {
    titleEl.textContent = 'Brak ID kursu';
    return;
  }
  titleEl.textContent = `Kurs #${courseId}`;

  try {
    const [mods, prog] = await Promise.all([
      apiFetch(`/modules/${courseId}`),
      apiFetch(`/progress/${courseId}`)
    ]);
    const done = new Set((prog.completed || []));

    listEl.innerHTML = '';
    (mods.modules || []).forEach(m => {
      const isDone = done.has(m.module_no);
      const locked = m.module_no !== 1 && !done.has(m.module_no - 1);

      const row = document.createElement('div');
      row.className = `module-item ${locked ? 'locked' : ''}`;
      row.innerHTML = `
        <div class="module-main">
          <div>
            <div class="module-no">Moduł ${m.module_no}</div>
            <div class="module-title">${m.title}</div>
          </div>
          <div class="module-actions">
            ${isDone ? '<span class="badge success">Ukończony</span>' : ''}
            ${m.requires_quiz ? '<span class="badge">Quiz</span>' : ''}
            <button class="btn-primary" data-open>Otwórz</button>
          </div>
        </div>
      `;

      row.querySelector('[data-open]').addEventListener('click', () => {
        if (locked) {
          showToast('Najpierw ukończ poprzedni moduł');
          return;
        }
        if (m.requires_quiz) {
          // otwórz quiz jako pierwsze zadanie
          window.location.href = `quiz.html?course=${courseId}&module=${m.module_no}`;
        } else {
          window.location.href = `module.html?course=${courseId}&module=${m.module_no}`;
        }
      });

      listEl.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    listEl.textContent = 'Nie udało się wczytać modułów (zaloguj się?).';
  }
}

load();
