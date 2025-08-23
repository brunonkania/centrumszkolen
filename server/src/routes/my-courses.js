// src/routes/my-courses.js
import { Router } from 'express';
import pg from 'pg';
import { requireAuth } from '../middleware/auth.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select c.id, c.title, c.is_active
      from user_course_access uca
      join courses c on c.id = uca.course_id
      where uca.user_id = $1 and c.is_active = true
      order by c.title
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
