import { Router } from 'express';
import { q } from '../db.js';

export const accessRouter = Router();

// GET /access/:token – publiczna strona (SSR prosto) z linkiem do frontowego quizu
accessRouter.get('/:token', async (req, res, next) => {
  try {
    const t = req.params.token;
    const { rows } = await q(
      `select ml.id,
              ml.expires_at,
              ml.used_at,
              o.id as order_id,
              o.email,
              c.slug,
              c.title,
              c.description
       from magic_links ml
       join orders o  on o.id = ml.order_id
       join courses c on c.id = o.course_id
       where ml.token = $1`,
      [t]
    );
    if (!rows.length) return res.status(404).send('Link nieprawidłowy.');

    const ml = rows[0];
    if (ml.used_at) {
      // Możesz chcieć blokować wielokrotne użycie; tu tylko informacja
      // return res.status(410).send('Link został już użyty.');
    }
    if (new Date(ml.expires_at) < new Date()) {
      return res.status(410).send('Link wygasł.');
    }

    // Zamiast błędnego /api/quiz/:slug/start – linkujemy do strony frontu:
    // /quiz.html?slug=<slug>&order=<order_id>
    const quizHref = `/quiz.html?slug=${encodeURIComponent(ml.slug)}&order=${encodeURIComponent(ml.order_id)}`;

    res.type('html').send(`<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Materiały – ${ml.title}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
body{font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f5f7fa;color:#0d1b3d;margin:0;padding:24px}
.card{max-width:900px;margin:0 auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 10px 30px rgba(13,27,61,.08)}
.btn{display:inline-block;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;background:linear-gradient(135deg,#a32cc4,#00c3ff);color:#fff}
.mod{border:1px solid #e6ecf5;border-radius:12px;padding:16px;margin:12px 0}
.muted{color:#506690;font-size:14px;margin-top:8px}
</style></head>
<body>
  <div class="card">
    <h1>${ml.title} — materiały</h1>
    <p>${ml.description}</p>
    <h2>Moduły</h2>
    <div class="mod"><strong>1. Wstęp</strong><br>PDF: <a href="#" target="_blank" rel="noopener">Pobierz</a></div>
    <div class="mod"><strong>2. Technika</strong><br>PDF: <a href="#" target="_blank" rel="noopener">Pobierz</a></div>
    <div class="mod"><strong>3. Bezpieczeństwo</strong><br>PDF: <a href="#" target="_blank" rel="noopener">Pobierz</a></div>

    <p style="margin-top:24px">
      <a class="btn" href="${quizHref}">Przejdź do quizu</a>
    </p>
    <p class="muted">Odbiorca: ${ml.email}</p>
  </div>
</body></html>`);
  } catch (e) { next(e); }
});
