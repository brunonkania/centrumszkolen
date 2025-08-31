import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  const rs = await query(`
    SELECT id, title, price_cents
    FROM courses
    ORDER BY id
  `);
  let enrolledSet = new Set();
  if (req.user?.sub) {
    const u = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
    if (u.rowCount > 0) {
      const userId = u.rows[0].id;
      const enr = await query('SELECT course_id FROM enrollments WHERE user_id=$1', [userId]);
      enrolledSet = new Set(enr.rows.map(r => Number(r.course_id)));
    }
  }
  res.json(rs.rows.map(r => ({
    id: r.id,
    title: r.title,
    price: (Number(r.price_cents) || 0) / 100,
    enrolled: enrolledSet.has(Number(r.id))
  })));
});

export default router;
