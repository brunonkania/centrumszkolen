// src/routes/courses.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();

/**
 * GET /courses
 * Kursy, do których zalogowany użytkownik ma dostęp (enrollment).
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user?.uid || req.user?.id;
    const r = await query(
      `SELECT c.id, c.title, c.description, c.price_cents
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = $1
       ORDER BY c.id`,
      [uid]
    );
    res.json({ courses: r.rows });
  } catch (e) {
    next(e);
  }
});

export default router;
