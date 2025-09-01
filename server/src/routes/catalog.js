// src/routes/catalog.js
import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /catalog
 * Publiczny katalog kursów widoczny w sklepie.
 */
router.get('/', optionalAuth, async (_req, res, next) => {
  try {
    const r = await query(
      'SELECT id, title, description, price_cents FROM courses ORDER BY id ASC'
    );
    res.json({ courses: r.rows });
  } catch (e) {
    next(e);
  }
});

export default router;
