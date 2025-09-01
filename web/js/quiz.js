// web/js/quiz.js
import { apiFetch } from './api.js';
import { showToast } from './ui.js';

const params = new URLSearchParams(location.search);
const courseId = Number(params.get('course') || 0);
const moduleNo = Number(params.get('module') || 0);

const h1 = document.getElementById('h1');
const form = document.getElementById('form');
const back = document.getElementById('back');
back.href = `kurs.html?id=${courseId}`;

let quiz = [];

async function load() {
  if (!courseId || !moduleNo) {
    form.textContent = 'Błędny adres.';
    return;
  }
  try {
    const r = await apiFetch(`/quiz/${courseId}/${moduleNo}`);
    quiz = r.quiz || [];
    h1.textContent = `Quiz – Moduł ${moduleNo} (min. ${r.pass_score}%)`;
    form.innerHTML = '';

    quiz.forEach((q, i) => {
      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `<div class="question"><strong>Pytanie ${i+1}:</strong> ${q.question}</div>`;
      const opts = document.createElement('div');
      opts.className = 'options';
      (q.options || []).forEach((opt, j) => {
        const id = `q${i}o${j}`;
        const line = document.createElement('label');
        line.className = 'option';
        line.innerHTML = `
          <input type="radio" name="q${i}" value="${j}" id="${id}"/>
          <span>${opt}</span>
        `;
        opts.appendChild(line);
      });
      block.appendChild(opts);
      form.appendChild(block);
    });

    const submit = document.createElement('button');
    submit.className = 'btn-primary mt-20';
    submit.type = 'submit';
    submit.textContent = 'Wyślij odpowiedzi';
    form.appendChild(submit);
  } catch (e) {
    console.error(e);
    form.textContent = 'Nie udało się wczytać quizu.';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const answers = quiz.map((_, i) => {
    const picked = form.querySelector(`input[name="q${i}"]:checked`);
    return picked ? Number(picked.value) : -1;
  });
  try {
    const r = await apiFetch(`/quiz/${courseId}/${moduleNo}`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
    const { score, passed, attempt } = r.result;
    showToast(`Wynik: ${score}% (${passed ? 'zaliczono' : 'niezaliczono'})`);
    // Jeżeli zaliczone – przenieś do modułu i pozwól zakończyć
    if (passed) {
      window.location.href = `module.html?course=${courseId}&module=${moduleNo}`;
    } else {
      // odśwież quiz (kolejna próba)
      load();
    }
  } catch (e2) {
    showToast('Błąd wysyłania odpowiedzi (limit prób?)');
  }
});

load();
