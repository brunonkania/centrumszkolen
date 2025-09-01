import { Router } from 'express';
import { query } from '../db.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const router = Router();

router.get('/verify/:serial', async (req, res) => {
  const serial = String(req.params.serial || '');
  const rs = await query(
    `SELECT c.serial, u.name, u.email, c.issued_at, co.title
       FROM certificates c
       JOIN users u ON u.id=c.user_id
       JOIN courses co ON co.id=c.course_id
      WHERE c.serial=$1`,
    [serial]
  );
  if (rs.rowCount === 0) return res.json({ valid: false });
  const row = rs.rows[0];
  res.json({ valid: true, serial: row.serial, name: row.name || row.email, course: row.title, issued_at: row.issued_at });
});

// Generowanie certyfikatu po zdaniu egzaminu (upraszczamy – endpoint chroniony)
router.post('/:courseId', async (req, res) => {
  const userEmail = req.user?.sub;
  const userRow = await query('SELECT id, name, email FROM users WHERE email=$1', [userEmail]);
  if (userRow.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const user = userRow.rows[0];

  const courseId = Number(req.params.courseId);
  const courseRow = await query('SELECT id, title FROM courses WHERE id=$1', [courseId]);
  if (courseRow.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });
  const course = courseRow.rows[0];

  // Czy już istnieje?
  const existing = await query('SELECT serial FROM certificates WHERE user_id=$1 AND course_id=$2', [user.id, course.id]);
  if (existing.rowCount > 0) {
    return res.json({ ok: true, serial: existing.rows[0].serial });
  }

  const serial = nanoid(12).toUpperCase();
  await query('INSERT INTO certificates (user_id, course_id, serial) VALUES ($1,$2,$3)', [user.id, course.id, serial]);

  // Generuj PDF
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, left: 60, right: 60, bottom: 60 } });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cert-${serial}.pdf"`);

  // Tło/ramka
  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#a32cc4').lineWidth(2).stroke();

  // Logo (opcjonalnie)
  try {
    const logoPath = path.resolve(process.cwd(), 'server', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (doc.page.width - 120) / 2, 40, { width: 120 });
    }
  } catch { /* ignore */ }

  doc.moveDown(3);

  // Nagłówek
  doc.fontSize(24).fillColor('#0d1b3d').text('CERTYFIKAT UKOŃCZENIA', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(16).fillColor('#52607a').text(course.title, { align: 'center' });

  doc.moveDown(2);

  // Nazwisko
  doc.fontSize(18).fillColor('#0d1b3d').text('Przyznany dla:', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(26).fillColor('#0d1b3d').text(user.name || user.email, { align: 'center' });

  doc.moveDown(2);

  // Serial i data
  doc.fontSize(12).fillColor('#52607a').text(`Numer certyfikatu: ${serial}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.text(`Data wydania: ${new Date().toLocaleDateString('pl-PL')}`, { align: 'center' });

  doc.moveDown(2);

  // Sekcja podpisów (prosty placeholder)
  const y = doc.y + 40;
  const colLeft = doc.page.width * 0.2;
  const colRight = doc.page.width * 0.6;
  doc.moveTo(colLeft, y).lineTo(colLeft + 160, y).strokeColor('#c4c9d4').lineWidth(1).stroke();
  doc.text('Podpis trenera', colLeft, y + 6, { width: 160, align: 'center', color: '#7a889f' });

  doc.moveTo(colRight, y).lineTo(colRight + 160, y).strokeColor('#c4c9d4').lineWidth(1).stroke();
  doc.text('Podpis organizatora', colRight, y + 6, { width: 160, align: 'center', color: '#7a889f' });

  doc.moveDown(4);

  // QR code + link weryfikacyjny
  const verifyUrlBase = process.env.FRONT_URL || 'http://localhost:5173';
  const verifyUrl = `${verifyUrlBase}/verify-certyfikat.html?serial=${encodeURIComponent(serial)}`;

  const dataUrl = await QRCode.toDataURL(verifyUrl);
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');

  doc.image(buffer, (doc.page.width - 120) / 2, doc.y, { width: 120 });
  doc.moveDown(1.2);
  doc.fontSize(10).fillColor('#52607a').text(verifyUrl, { align: 'center' });

  doc.end();
  doc.pipe(res);
});

export default router;
