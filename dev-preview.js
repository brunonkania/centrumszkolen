// dev-preview.js — no-auth demo with materials/quiz mocks (Express 5)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5173;
const WEB_DIR = path.join(__dirname, 'web');

app.use(express.json());

// Logger
app.use((req, _res, next) => { console.log(`[DEV] ${req.method} ${req.url}`); next(); });

// Statics
app.use(express.static(WEB_DIR, { extensions: ['html'] }));

// Catalog mock
app.get('/api/catalog', (_req, res) => {
  res.json({ items: [
    { id: 101, title: 'Kurs Trener Personalny', description: 'Kompletny program + certyfikat.', price_cents: 34900,
      thumbnail_url: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=1200&auto=format&fit=crop' },
    { id: 202, title: 'Instruktor Pływania — podstawy', description: 'Technika stylów i bezpieczeństwo.', price_cents: 29900,
      thumbnail_url: 'https://images.unsplash.com/photo-1508612761958-e931d843bdd2?q=80&w=1200&auto=format&fit=crop' },
    { id: 303, title: 'Dietetyka w sportach walki', description: 'Makro, cutting, peri-workout.', price_cents: 19900,
      thumbnail_url: 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=1200&auto=format&fit=crop' }
  ]});
});

// Materials mock (token required)
app.get('/api/guest/materials', (req, res) => {
  const token = String(req.query.token||'');
  if(!token || token.length < 5) return res.status(401).json({ error:'invalid token' });
  res.json({
    course: { id: 101, title: 'Kurs Trener Personalny' },
    modules: [
      { id: 1, title: 'Wprowadzenie', content_html: '<p>Cel kursu, struktura, wymagania.</p>' },
      { id: 2, title: 'Anatomia podstawowa', content_html: '<p>Najważniejsze grupy mięśniowe i funkcje.</p>' },
      { id: 3, title: 'Planowanie treningu', content_html: '<p>Objętość, intensywność, progresja.</p>' }
    ],
    quiz: {
      id: 999,
      questions: [
        { id: 11, text: 'Ile dużych grup mięśniowych trenuje klasyczny full-body?', answers: [
          {id:'a', text:'1–2'}, {id:'b', text:'3–4'}, {id:'c', text:'5–6'} ]},
        { id: 12, text: 'Który parametr rośnie przy progresji?', answers: [
          {id:'d', text:'Objętość/ciężar/czas'}, {id:'e', text:'Liczba przerw'}, {id:'f', text:'Długość snu w ciągu dnia'} ]}
      ]
    }
  });
});

// Quiz submit mock
app.post('/api/guest/quiz/submit', (req, res) => {
  const { token, answers=[] } = req.body||{};
  if(!token) return res.status(400).json({ error:'missing token' });
  // super-prosty mock: jak są 2 odpowiedzi, zaliczamy :)
  const passed = (answers||[]).length >= 2;
  res.json({
    passed,
    score: passed ? 100 : 50,
    certificate_url: passed ? 'https://example.com/certyfikat-mock.pdf' : undefined,
    message: passed ? 'Gratulacje! Zaliczone.' : 'Spróbuj ponownie – przejrzyj moduły i wróć do testu.'
  });
});

// Fallback
app.use((_req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`[DEV] Preview running at http://localhost:${PORT}`);
  console.log(`[DEV] Open: http://localhost:${PORT}`);
});
