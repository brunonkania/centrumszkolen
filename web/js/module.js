import { api } from './js/api.js';
import { requireAuthOrRedirect, logout } from './js/auth.js';

await requireAuthOrRedirect();

const sp = new URLSearchParams(location.search);
const courseId = Number(sp.get('course') || 1);
const moduleNo = Number(sp.get('no') || 1);

const courseTitle = document.getElementById('courseTitle');
const progressText = document.getElementById('progressText');
const moduleTitle = document.getElementById('moduleTitle');
const videoContainer = document.getElementById('videoContainer');
const moduleBody = document.getElementById('moduleBody');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const completeBtn = document.getElementById('completeBtn');
const quizBtn = document.getElementById('quizBtn');
const courseBtn = document.getElementById('courseBtn');
const backToCourse = document.getElementById('backToCourse');
const msgEl = document.getElementById('msg');

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await api('/auth/logout', { method:'POST' });
  logout();
  location.replace('./index.html');
});

function linkToCourse() {
  const url = `./kurs.html?id=${courseId}`;
  courseBtn.href = url;
  backToCourse.href = url;
}
linkToCourse();

async function loadModule() {
  msgEl.textContent = '';
  try {
    const data = await api(`/modules/${courseId}/${moduleNo}`);
    render(data);
  } catch (e) {
    if (String(e.message || '').includes('LOCKED')) {
      msgEl.innerHTML = 'Ten moduł jest zablokowany. Wróć do <a href="./kurs.html?id=' + courseId + '">listy modułów</a>.';
    } else if (String(e.message || '').includes('NOT_ENROLLED')) {
      msgEl.innerHTML = 'Nie masz dostępu do kursu. Przejdź do <a href="./sklep.html">sklepu</a>.';
    } else if (String(e.message || '').includes('MODULE_DRAFT')) {
      msgEl.textContent = 'Moduł w wersji roboczej – niedostępny.';
    } else {
      msgEl.textContent = e.message || 'Nie udało się wczytać modułu.';
    }
  }
}

function render(data) {
  courseTitle.textContent = data.course.title;
  progressText.textContent = `Postęp: ${data.course.percent}%`;
  moduleTitle.textContent = `${data.module.id}. ${data.module.title}`;

  videoContainer.innerHTML = '';
  if (data.module.videoUrl) {
    videoContainer.style.display = 'block';
    if (data.module.videoUrl.includes('youtube.com') || data.module.videoUrl.includes('youtu.be')) {
      videoContainer.innerHTML = `<iframe src="${data.module.videoUrl}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      videoContainer.innerHTML = `<video controls src="${data.module.videoUrl}"></video>`;
    }
  } else {
    videoContainer.style.display = 'none';
  }

  moduleBody.innerHTML = data.module.contentHtml || '';

  prevBtn.disabled = !data.nav.prev;
  nextBtn.disabled = !data.nav.next;
  completeBtn.disabled = data.module.completed || data.module.requiresQuiz;
  quizBtn.style.display = data.module.requiresQuiz ? 'inline-block' : 'none';
  quizBtn.href = `./quiz.html?course=${courseId}&no=${data.module.id}`;

  prevBtn.onclick = () => { if (data.nav.prev) location.replace(`./module.html?course=${courseId}&no=${data.nav.prev}`); };
  nextBtn.onclick = () => { if (data.nav.next) location.replace(`./module.html?course=${courseId}&no=${data.nav.next}`); };
  completeBtn.onclick = async () => {
    msgEl.textContent = 'Zapisywanie...';
    try {
      const view = await api(`/progress/${courseId}/complete`, { method: 'POST', body: { moduleId: moduleNo } });
      msgEl.textContent = 'Zaliczone ✅';
      if (data.nav.next) setTimeout(() => location.replace(`./module.html?course=${courseId}&no=${data.nav.next}`), 600);
      else setTimeout(() => location.replace(`./kurs.html?id=${courseId}`), 600);
    } catch (e) {
      if (String(e.message || '').includes('LOCKED')) msgEl.textContent = 'Moduł jest jeszcze zablokowany.';
      else if (String(e.message || '').includes('QUIZ_REQUIRED')) msgEl.textContent = 'Ten moduł wymaga zaliczenia quizu.';
      else msgEl.textContent = e.message || 'Błąd zapisu.';
    }
  };
}

loadModule();
