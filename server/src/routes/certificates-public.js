// src/routes/certificates-public.js
import { Router } from 'express';
import { query } from '../db.js';

/**
 * Publiczny router certyfikatów (BEZ autoryzacji).
 * Umożliwia sprawdzanie ważności certyfikatu po numerze seryjnym.
 *
 * GET /certificates/verify/:serial
 *   -> { valid: boolean, serial?, course_title?, user_name?, issued_at?, pdf_url? }
 */
const router = Router();

router.get('/verify/:serial', async (req, res, next) => {
  try {
    const serial = String(req.params.serial || '').trim();
    if (!serial) return res.status(400).json({ valid: false, error: 'INVALID_SERIAL' });

    const r = await query(
      `SELECT c.serial,
              c.pdf_url,
              c.created_at AS issued_at,
              u.name  AS user_name,
              crs.title AS course_title
         FROM certificates c
         JOIN users u  ON u.id = c.user_id
         JOIN courses crs ON crs.id = c.course_id
        WHERE c.serial = $1
        LIMIT 1`,
      [serial]
    );

    if (r.rowCount === 0) {
      return res.json({ valid: false });
    }

    const row = r.rows[0];
    return res.json({
      valid: true,
      serial: row.serial,
      course_title: row.course_title,
      user_name: row.user_name,
      issued_at: row.issued_at,
      pdf_url: row.pdf_url || ''
    });
  } catch (e) {
    next(e);
  }
});

export default router;
