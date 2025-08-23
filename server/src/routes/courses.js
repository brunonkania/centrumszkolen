import { Router } from 'express';
import pg from 'pg';
import { optionalAuth } from '../middleware/auth.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const { rows } = await pool.query(`
        select
          c.id, c.title, c.is_active,
          exists (
            select 1 from user_course_access uca
            where uca.course_id = c.id and uca.user_id = $1
          ) as has_access
        from courses c
        where c.is_active = true
        order by c.title
      `, [req.user.id]);
      return res.json(rows);
    } else {
      const { rows } = await pool.query(`
        select id, title, is_active, false as has_access
        from courses
        where is_active = true
        order by title
      `);
      return res.json(rows);
    }
  } catch (e) { next(e); }
});

export default router;
