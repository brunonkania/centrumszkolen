import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import sanitizeHtml from 'sanitize-html';

const router = Router();
router.use(requireAdmin);

router.get('/modules/:courseId', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const rs = await query('SELECT module_no, title, status FROM modules WHERE course_id=$1 ORDER BY module_no', [courseId]);
  res.json(rs.rows.map(r => ({ id: r.module_no, title: r.title, status: r.status })));
});

router.get('/module/:courseId/:moduleNo', async (req, res) => {
  const { courseId, moduleNo } = req.params;
  const rs = await query('SELECT module_no, title, content_html, video_url, requires_quiz, pass_score, attempt_limit, quiz_json, status FROM modules WHERE course_id=$1 AND module_no=$2', [courseId, moduleNo]);
  if (rs.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  const m = rs.rows[0];
  res.json({
    id: Number(m.module_no),
    title: m.title,
    contentHtml: m.content_html || '',
    videoUrl: m.video_url || '',
    requiresQuiz: m.requires_quiz,
    passScore: Number(m.pass_score),
    attemptLimit: Number(m.attempt_limit),
    status: m.status,
    quiz: m.quiz_json ? JSON.parse(m.quiz_json) : { questions: [] }
  });
});

router.post('/module/:courseId/:moduleNo', async (req, res) => {
  const { courseId, moduleNo } = req.params;
  const { title, contentHtml, videoUrl, requiresQuiz, passScore, attemptLimit, quiz, status } = req.body || {};
  const cleanHtml = sanitizeHtml(contentHtml || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'h1','h2','img','iframe','video','source' ]),
    allowedAttributes: {
      a: [ 'href','name','target','rel' ],
      img: [ 'src','alt' ],
      iframe: [ 'src','allow','allowfullscreen','frameborder' ],
      video: [ 'src','controls' ],
      source: [ 'src','type' ]
    },
    allowedIframeHostnames: [ 'www.youtube.com', 'player.vimeo.com' ]
  });

  await query(`UPDATE modules
               SET title=$1, content_html=$2, video_url=$3, requires_quiz=$4, pass_score=$5, attempt_limit=$6, quiz_json=$7, status=$8, published_at=CASE WHEN $8='published' THEN COALESCE(published_at, now()) ELSE published_at END
               WHERE course_id=$9 AND module_no=$10`,
              [title || '', cleanHtml, videoUrl || '', !!requiresQuiz, Number(passScore)||70, Number(attemptLimit)||3, JSON.stringify(quiz||{questions:[]}), status === 'draft' ? 'draft' : 'published', Number(courseId), Number(moduleNo)]);
  res.json({ ok: true });
});

router.post('/modules/:courseId/reorder', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const order = req.body?.order; // array of module_nos in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order required' });
  // naive reorder using temp seq
  for (let i = 0; i < order.length; i++) {
    await query('UPDATE modules SET module_no=$1 WHERE course_id=$2 AND module_no=$3', [i+1, courseId, Number(order[i])]);
  }
  res.json({ ok: true });
});

export default router;
