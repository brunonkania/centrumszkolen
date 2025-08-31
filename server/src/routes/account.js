import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/export', async (req, res) => {
  const email = req.user?.sub;
  const u = await query('SELECT id, email, name, role, email_verified, created_at FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const user = u.rows[0];
  const enrollments = (await query('SELECT course_id, created_at FROM enrollments WHERE user_id=$1', [user.id])).rows;
  const progress = (await query('SELECT course_id, module_no, created_at FROM progress WHERE user_id=$1', [user.id])).rows;
  const orders = (await query('SELECT id, course_id, amount_cents, currency, status, created_at, paid_at FROM orders WHERE user_id=$1', [user.id])).rows;
  const attempts = (await query('SELECT course_id, module_no, score, passed, created_at FROM quiz_attempts WHERE user_id=$1', [user.id])).rows;
  const certs = (await query('SELECT course_id, serial, issued_at FROM certificates WHERE user_id=$1', [user.id])).rows;
  res.json({ user, enrollments, progress, orders, attempts, certificates: certs });
});

router.delete('/delete', async (req, res) => {
  const email = req.user?.sub;
  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  await query('DELETE FROM users WHERE id=$1', [u.rows[0].id]);
  res.json({ ok: true });
});

export default router;
