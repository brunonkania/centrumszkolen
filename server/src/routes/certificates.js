import { Router } from 'express';
import { query } from '../db.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';

const router = Router();

router.get('/verify/:serial', async (req, res) => {
  const serial = String(req.params.serial || '');
  const rs = await query('SELECT c.serial, u.name, u.email, c.course_id, co.title, c.issued_at FROM certificates c JOIN users u ON u.id=c.user_id JOIN courses co ON co.id=c.course_id WHERE c.serial=$1', [serial]);
  if (rs.rowCount === 0) return res.json({ valid: false });
  const row = rs.rows[0];
  res.json({ valid: true, serial: row.serial, name: row.name || row.email, course: row.title, issued_at: row.issued_at });
});

router.get('/:courseId.pdf', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const email = req.user?.sub;
  const u = await query('SELECT id, name FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;
  const name = u.rows[0].name || email;

  const c = await query('SELECT title FROM courses WHERE id=$1', [courseId]);
  if (c.rowCount === 0) return res.status(404).json({ error: 'Course not found' });
  const title = c.rows[0].title;

  const totalRs = await query("SELECT COUNT(*)::int AS total FROM modules WHERE course_id=$1 AND status='published'", [courseId]);
  const doneRs = await query('SELECT COUNT(*)::int AS done FROM progress WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  if (doneRs.rows[0].done < totalRs.rows[0].total) return res.status(403).json({ error: 'NOT_COMPLETED' });

  // find or create certificate
  let cert = await query('SELECT serial FROM certificates WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  let serial;
  if (cert.rowCount > 0) {
    serial = cert.rows[0].serial;
  } else {
    serial = nanoid(12).toUpperCase();
    await query('INSERT INTO certificates (user_id, course_id, serial) VALUES ($1,$2,$3)', [userId, courseId, serial]);
  }
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-certyfikat.html?serial=${serial}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cert-${courseId}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.fontSize(24).text('CERTYFIKAT UKOŃCZENIA', { align: 'center' });
  doc.moveDown();
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`Uczestnik: ${name}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Serial: ${serial}`, { align: 'center' });

  // QR code
  const dataUrl = await QRCode.toDataURL(verifyUrl);
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  doc.image(buffer, (doc.page.width-150)/2, doc.y + 10, { width: 150 });
  doc.moveDown(5);
  doc.fontSize(10).text(verifyUrl, { align: 'center' });

  doc.end();
  doc.pipe(res);
});

export default router;
