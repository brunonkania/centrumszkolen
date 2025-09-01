// web/js/panel.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

async function getProgress(courseId) {
  try {
    const [mods, prog] = await Promise.all([
      apiFetch(`/modules/${courseId}`),
      apiFetch(`/progress/${courseId}`),
    ]);
    const total = (mods.modules || []).length;
    const done = (prog.completed || []).length;
    return { total, done };
  } catch {
    return { total: 0, done: 0 };
  }
}

async function getCertificate(courseId) {
  try {
    const r = await apiFetch(`/certificates/${courseId}`);
    return r.certificate || null;
  } catch {
    return null;
  }
}

function renderCourse(el, c, stat, cert) {
  const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
  const nextModule = stat.done + 1;

  const card = document.createElement('div');
  card.className = 'course-card';
  card.innerHTML = `
    <h3>${c.title}</h3>
    <p>${c.description || ''}</p>

    <div class="progress">
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="meta">${stat.done}/${stat.total} (${pct}%)</div>
    </div>

    <div class="actions">
      <button class="btn-primary" data-continue>Kontynuuj</button>
      ${
        cert
          ? `<a class="btn-secondary" href="${cert.pdf_url}" target="_blank" rel="noopener">Pobierz certyfikat</a>`
          : `<button class="btn-secondary" data-issue>Wystaw certyfikat</button>`
      }
      <button class="btn-secondary" data-open>Karta kursu</button>
    </div>
  `;

  // handlers
  card.querySelector('[data-open]').addEventListener('click', () => {
    window.location.href = `kurs.html?id=${c.id}`;
  });

  card.querySelector('[data-continue]').addEventListener('click', () => {
    const target = nextModule <= stat.total ? nextModule : stat.total;
    window.location.href = `module.html?course=${c.id}&module=${target}`;
  });

  const issueBtn = card.querySelector('[data-issue]');
  if (issueBtn) {
    issueBtn.addEventListener('click', async () => {
      try {
        const r = await apiFetch(`/certificates/${c.id}/issue`, { method: 'POST' });
        showToast('Certyfikat wystawiony 🎉');
        // odśwież kartę
        const cert = r.certificate;
        card.querySelector('[data-issue]').replaceWith(
          Object.assign(document.createElement('a'), {
            className: 'btn-secondary',
            href: cert.pdf_url,
            target: '_blank',
            rel: 'noopener',
            textContent: 'Pobierz certyfikat'
          })
        );
      } catch (e) {
        showToast('Nie można wystawić (ukończ wszystkie moduły)');
      }
    });
  }

  el.appendChild(card);
}

export async function initPanel() {
  const hello = document.getElementById('hello');
  const list = document.getElementById('my-courses');

  try {
    const me = await apiFetch('/auth/me');
    hello.textContent = `Cześć, ${me.user.name || me.user.email}!`;

    const data = await apiFetch('/courses');
    const courses = data.courses || [];
    list.innerHTML = '';
    if (courses.length === 0) {
      list.innerHTML = '<p>Nie masz jeszcze żadnych kursów. Wejdź do <a href="kursy.html">Sklepu</a>.</p>';
      return;
    }

    for (const c of courses) {
      const [stat, cert] = await Promise.all([
        getProgress(c.id),
        getCertificate(c.id)
      ]);
      renderCourse(list, c, stat, cert);
    }
  } catch (e) {
    hello.textContent = 'Musisz być zalogowany.';
    list.innerHTML = '<p><a href="logowanie.html">Zaloguj się</a>, aby zobaczyć swoje kursy.</p>';
  }
}

initPanel();
