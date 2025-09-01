// src/routes/certificates.js
import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const router = Router();
router.use(requireAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CERTS_DIR = path.join(PUBLIC_DIR, 'certificates');

function ensureDirs() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });
}

/**
 * GET /certificates/:courseId
 * Zwraca istniejący certyfikat użytkownika dla kursu (jeśli jest).
 */
router.get('/:courseId', async (req, res) => {
  const ps = z.object({ courseId: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const userId = req.user?.uid || req.user?.id;
  const { courseId } = ps.data;

  const r = await query(
    'SELECT id, serial, pdf_url, created_at FROM certificates WHERE user_id=$1 AND course_id=$2',
    [userId, courseId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json({ certificate: r.rows[0] });
});

/**
 * POST /certificates/:courseId/issue
 * Wystawia certyfikat, jeśli wszystkie moduły są zaliczone.
 * Zwraca istniejący, jeśli już wystawiony.
 */
router.post('/:courseId/issue', async (req, res, next) => {
  const ps = z.object({ courseId: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const userId = req.user?.uid || req.user?.id;
  const { courseId } = ps.data;

  try {
    // jeśli jest już certyfikat → zwróć
    const existing = await query(
      'SELECT id, serial, pdf_url, created_at FROM certificates WHERE user_id=$1 AND course_id=$2',
      [userId, courseId]
    );
    if (existing.rowCount > 0) {
      return res.json({ certificate: existing.rows[0], reused: true });
    }

    // czy user ma enrollment?
    const enr = await query(
      'SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2',
      [userId, courseId]
    );
    if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ENROLLMENT' });

    // policz moduły i progres
    const mods = await query(
      "SELECT COUNT(*)::int AS total FROM modules WHERE course_id=$1 AND status='published'",
      [courseId]
    );
    const done = await query(
      'SELECT COUNT(*)::int AS done FROM progress WHERE user_id=$1 AND course_id=$2',
      [userId, courseId]
    );
    const total = mods.rows[0].total || 0;
    const completed = done.rows[0].done || 0;

    if (total === 0) return res.status(400).json({ error: 'NO_MODULES' });
    if (completed < total) return res.status(400).json({ error: 'NOT_COMPLETED' });

    // generuj certyfikat PDF
    ensureDirs();

    const serial = `CS-${nanoid(10).toUpperCase()}`;
    const fileName = `${serial}.pdf`;
    const filePath = path.join(CERTS_DIR, fileName);

    // pobierz nazwę kursu i użytkownika
    const cr = await query('SELECT title FROM courses WHERE id=$1', [courseId]);
    const ur = await query('SELECT name, email FROM users WHERE id=$1', [userId]);
    const courseTitle = cr.rows[0]?.title || `Kurs #${courseId}`;
    const userName = ur.rows[0]?.name || `Użytkownik #${userId}`;
    const userEmail = ur.rows[0]?.email || '';

    // link weryfikacyjny/odczytu (możesz podmienić na stronę weryfikacji)
    const appUrl = env.APP_URL || 'http://localhost:3000';
    const pdfUrl = `${appUrl}/public/certificates/${fileName}`;
    const qrData = pdfUrl;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Nagłówek
    doc.fontSize(20).fillColor('#0d1b3d').text('CERTYFIKAT UKOŃCZENIA KURSU', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).fillColor('#333').text(`Niniejszym zaświadcza się, że:`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(22).fillColor('#000').text(userName, { align: 'center' });
    doc.moveDown();

    // Treść
    doc.fontSize(14).fillColor('#333')
      .text(`ukończył(a) kurs:`, { align: 'center' })
      .moveDown(0.2)
      .fontSize(18).fillColor('#0d1b3d')
      .text(courseTitle, { align: 'center' })
      .moveDown();

    doc.fontSize(12).fillColor('#555')
      .text(`Data wystawienia: ${new Date().toLocaleDateString()}`, { align: 'center' })
      .moveDown(0.2)
      .text(`Numer certyfikatu: ${serial}`, { align: 'center' })
      .moveDown(1);

    // QR
    const qrPng = await QRCode.toBuffer(qrData, { width: 150 });
    const x = (doc.page.width - 150) / 2;
    doc.image(qrPng, x, doc.y, { width: 150 });
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#777').text(pdfUrl, { align: 'center' });

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // zapis w DB
    const ins = await tx(async (client) => {
      const r = await client.query(
        `INSERT INTO certificates (user_id, course_id, serial, pdf_url)
         VALUES ($1,$2,$3,$4)
         RETURNING id, serial, pdf_url, created_at`,
        [userId, courseId, serial, pdfUrl]
      );
      return r.rows[0];
    });

    return res.json({ certificate: ins });
  } catch (e) {
    next(e);
  }
});

export default router;
