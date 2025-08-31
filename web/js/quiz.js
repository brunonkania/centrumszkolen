import { api } from './js/api.js';
import { requireAuthOrRedirect } from './js/auth.js';

await requireAuthOrRedirect();

const sp = new URLSearchParams(location.search);
const courseId = Number(sp.get('course') || 1);
const moduleNo = Number(sp.get('no') || 1);

const hint = document.getElementById('hint');
const form = document.getElementById('quizForm');
const msg = document.getElementById('msg');
const back = document.getElementById('backToModule');
back.href = `./module.html?course=${courseId}&no=${moduleNo}`;

function renderQuestion(q, idx) {
  if (q.type === 'tf') {
    return `
      <fieldset>
        <legend>${idx+1}. ${q.q}</legend>
        <label><input type="radio" name="q${idx}" value="true" required> Prawda</label><br>
        <label><input type="radio" name="q${idx}" value="false" required> Fałsz</label>
      </fieldset>
    `;
  }
  const opts = q.options || [];
  if (q.type === 'multi') {
    return `
      <fieldset>
        <legend>${idx+1}. ${q.q} (wiele odpowiedzi)</legend>
        ${opts.map((opt, i) => `<label><input type="checkbox" name="q${idx}" value="${i}"> ${opt}</label>`).join('<br>')}
      </fieldset>
    `;
  }
  // single
  return `
    <fieldset>
      <legend>${idx+1}. ${q.q}</legend>
      ${opts.map((opt, i) => `<label><input type="radio" name="q${idx}" value="${i}" required> ${opt}</label>`).join('<br>')}
    </fieldset>
  `;
}

async function load() {
  msg.textContent = '';
  try {
    const data = await api(`/quiz/${courseId}/${moduleNo}`);
    hint.textContent = `Próg: ${data.passScore}% • Pozostało prób: ${data.left}/${data.attemptLimit}`;
    const qs = (data.quiz.questions || []);
    form.innerHTML = qs.map((q, idx) => renderQuestion(q, idx)).join('');
  } catch (e) {
    msg.textContent = e.message || 'Błąd wczytywania quizu.';
  }
}

document.getElementById('submitBtn').addEventListener('click', async (e)=>{
  e.preventDefault();
  const answers = [];
  form.querySelectorAll('fieldset').forEach((fs, idx)=>{
    const radios = Array.from(fs.querySelectorAll('input[type="radio"]'));
    const checks = Array.from(fs.querySelectorAll('input[type="checkbox"]'));
    if (checks.length) {
      const arr = checks.filter(c => c.checked).map(c => Number(c.value));
      answers[idx] = arr;
    } else if (radios.length) {
      const sel = radios.find(r => r.checked);
      answers[idx] = sel ? (sel.value === 'true' ? [1] : sel.value === 'false' ? [0] : Number(sel.value)) : null;
    }
  });
  msg.textContent = 'Sprawdzanie...';
  try {
    const res = await api(`/quiz/${courseId}/${moduleNo}/submit`, { method:'POST', body:{ answers } });
    if (res.passed) {
      msg.textContent = `Zaliczono ✅ (${res.score}%)`;
      setTimeout(()=> location.replace(`./module.html?course=${courseId}&no=${moduleNo}`), 800);
    } else {
      msg.textContent = `Nie zaliczono ❌ (${res.score}%, wymagane ${res.required}%)`;
    }
  } catch (e) {
    msg.textContent = e.message || 'Błąd wysyłki.';
  }
});

load();
