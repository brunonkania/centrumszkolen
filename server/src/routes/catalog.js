const Router = require('express').Router;
const { randomToken } = require('../util/token');

module.exports = (db, mailer) => {
  const router = Router();

  // POST /api/guest/checkout  { email, course_slug }
  // DEV: tworzy order 'paid' i generuje magic link. Produkcyjnie: generuj po webhooku "paid".
  router.post('/guest/checkout', async (req, res, next) => {
    try{
      const { email, course_slug } = req.body || {};
      if(!email || !course_slug) return res.status(400).json({ error:'email_and_course_slug_required' });

      // znajdź kurs
      const { rows: crows } = await db.query(`SELECT id, title FROM courses WHERE slug=$1`, [course_slug]);
      if(crows.length === 0) return res.status(404).json({ error:'course_not_found' });
      const course = crows[0];

      // DEV: tworzymy order jako paid (w prod. zrób to po potwierdzeniu bramki płatności)
      const { rows: orows } = await db.query(`
        INSERT INTO orders (course_id, email, status) VALUES ($1, $2, 'paid')
        RETURNING id
      `,[course.id, email]);
      const orderId = orows[0].id;

      // Generuj token i link
      const token = randomToken(32);
      const expiresAt = new Date(Date.now() + 30*24*3600*1000); // 30 dni
      await db.query(`
        INSERT INTO magic_links (token, email, course_id, expires_at, max_uses)
        VALUES ($1,$2,$3,$4,$5)
      `,[token, email, course.id, expiresAt, 5]);

      const accessUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/materials.html?token=${token}`;

      // Wyślij mail (prosty szablon)
      if(mailer){
        await mailer.send({
          to: email,
          subject: `Dostęp do kursu: ${course.title}`,
          html: `
            <p>Cześć!</p>
            <p>Oto Twój link do materiałów kursu <strong>${course.title}</strong>:</p>
            <p><a href="${accessUrl}">${accessUrl}</a></p>
            <p>Link ważny do: ${expiresAt.toISOString().slice(0,10)} (maks. 5 użyć).</p>
            <p>Powodzenia!</p>
          `
        });
      }

      res.json({ ok:true, order_id: orderId, access_url: accessUrl });
    }catch(e){ next(e); }
  });

  // GET /api/guest/materials?token=...
  router.get('/guest/materials', async (req, res, next) => {
    try{
      const token = String(req.query.token||'');
      if(!token) return res.status(400).json({ error:'missing_token' });

      const { rows: links } = await db.query(`
        SELECT ml.*, c.title AS course_title, c.id AS course_id
        FROM magic_links ml
        JOIN courses c ON c.id=ml.course_id
        WHERE ml.token=$1
      `,[token]);

      if(links.length === 0) return res.status(401).json({ error:'invalid_token' });
      const link = links[0];
      if(link.revoked) return res.status(401).json({ error:'revoked' });
      if(link.expires_at && new Date(link.expires_at) < new Date()) return res.status(401).json({ error:'expired' });
      if(link.used_count >= link.max_uses) return res.status(401).json({ error:'max_uses_reached' });

      // zarejestruj użycie (miękkie; możesz też odkładać to po POST submit)
      await db.query(`UPDATE magic_links SET used_count=used_count+1, last_used_at=now() WHERE id=$1`, [link.id]);

      // materiały
      const { rows: mods } = await db.query(`
        SELECT id, title, content_html
        FROM modules WHERE course_id=$1 ORDER BY position ASC, id ASC
      `,[link.course_id]);

      // quiz
      const { rows: qs } = await db.query(`SELECT id, text FROM quiz_questions WHERE course_id=$1 ORDER BY id ASC`,[link.course_id]);
      let questions = [];
      if(qs.length){
        const qIds = qs.map(q=>q.id);
        const { rows: ans } = await db.query(`SELECT id, question_id, text FROM quiz_answers WHERE question_id = ANY($1::int[]) ORDER BY id ASC`,[qIds]);
        questions = qs.map(q => ({
          id: q.id,
          text: q.text,
          answers: ans.filter(a=>a.question_id===q.id).map(a=>({ id: a.id, text: a.text }))
        }));
      }

      res.json({
        course: { id: link.course_id, title: link.course_title },
        modules: mods,
        quiz: { id: link.course_id, questions }
      });
    }catch(e){ next(e); }
  });

  // POST /api/guest/quiz/submit { token, answers:[{question_id, answer_id}] }
  router.post('/guest/quiz/submit', async (req, res, next) => {
    try{
      const { token, answers=[] } = req.body || {};
      if(!token) return res.status(400).json({ error:'missing_token' });

      const { rows: links } = await db.query(`
        SELECT ml.*, c.title AS course_title
        FROM magic_links ml JOIN courses c ON c.id=ml.course_id
        WHERE token=$1
      `,[token]);
      if(links.length === 0) return res.status(401).json({ error:'invalid_token' });
      const link = links[0];
      if(link.revoked) return res.status(401).json({ error:'revoked' });
      if(link.expires_at && new Date(link.expires_at) < new Date()) return res.status(401).json({ error:'expired' });

      // Pobierz poprawne odpowiedzi
      const { rows: qs } = await db.query(`SELECT id FROM quiz_questions WHERE course_id=$1`,[link.course_id]);
      if(qs.length === 0) return res.json({ passed:true, score:100, certificate_url:null, message:'Brak pytań — zaliczono technicznie.' });

      const qIds = qs.map(q=>q.id);
      const { rows: ans } = await db.query(`SELECT id, question_id, is_correct FROM quiz_answers WHERE question_id = ANY($1::int[])`,[qIds]);
      const correctByQ = new Map();
      ans.forEach(a=>{
        if(a.is_correct){
          const set = correctByQ.get(a.question_id) || new Set();
          set.add(String(a.id));
          correctByQ.set(a.question_id, set);
        }
      });

      // policz wynik (pojedynczy wybór)
      let good = 0;
      let total = qs.length;
      const byQ = new Map(answers.map(a => [Number(a.question_id), String(a.answer_id)]));
      for(const q of qs){
        const chosen = byQ.get(q.id);
        const correct = correctByQ.get(q.id) || new Set();
        if(chosen && correct.has(String(chosen))) good++;
      }
      const score = Math.round(100 * good / Math.max(1,total));
      const passed = score >= 80; // próg

      // (opcjonalnie) wystaw certyfikat i zwróć URL
      const certificateUrl = passed ? `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/certyfikaty/mock-${Date.now()}.pdf` : null;

      res.json({
        passed, score, certificate_url: certificateUrl,
        message: passed ? `Gratulacje! Zdałeś/aś kurs: ${link.course_title}.` : 'Niestety próg 80% nie został osiągnięty. Spróbuj ponownie.'
      });
    }catch(e){ next(e); }
  });

  return router;
};
