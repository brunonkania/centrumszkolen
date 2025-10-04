// server/src/routes/sitemap.js
const Router = require('express').Router;

function xmlEscape(s=''){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&apos;");
}

module.exports = (db) => {
  const router = Router();

  // GET /sitemap.xml
  router.get('/sitemap.xml', async (req, res, next) => {
    try{
      const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/,'') ||
                   `${req.protocol}://${req.get('host')}`;

      // pobierz slug’i kursów
      const { rows } = await db.query(`
        SELECT slug, greatest(
          COALESCE((SELECT MAX(updated_at) FROM modules m JOIN courses c ON m.course_id=c.id WHERE c.slug=courses.slug), '1970-01-01'::timestamp),
          COALESCE((SELECT MAX(updated_at) FROM quiz_questions q JOIN courses c ON q.course_id=c.id WHERE c.slug=courses.slug), '1970-01-01'::timestamp),
          now() - interval '7 days' -- fallback
        ) AS lastmod
        FROM courses
        ORDER BY slug ASC
      `);

      const urls = [];

      // Stałe strony
      urls.push({ loc: `${base}/`, changefreq: 'weekly', priority: '1.0' });
      urls.push({ loc: `${base}/#sklep`, changefreq: 'daily', priority: '0.9' });
      urls.push({ loc: `${base}/certyfikaty.html`, changefreq: 'monthly', priority: '0.5' });
      urls.push({ loc: `${base}/regulamin.html`, changefreq: 'yearly', priority: '0.3' });
      urls.push({ loc: `${base}/polityka.html`, changefreq: 'yearly', priority: '0.3' });
      urls.push({ loc: `${base}/kontakt.html`, changefreq: 'yearly', priority: '0.3' });

      // Kursy po pretty URL: /kurs/<slug>
      for(const r of rows){
        urls.push({
          loc: `${base}/kurs/${encodeURIComponent(r.slug)}`,
          lastmod: new Date(r.lastmod || Date.now()).toISOString(),
          changefreq: 'weekly',
          priority: '0.8'
        });
      }

      // Budowa XML
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : ''}
    ${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}
    ${u.priority ? `<priority>${u.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`);
    }catch(e){ next(e); }
  });

  // GET /robots.txt  (wskazuje sitemap)
  router.get('/robots.txt', (req, res) => {
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/,'') ||
                 `${req.protocol}://${req.get('host')}`;
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(
`User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`
    );
  });

  return router;
};
