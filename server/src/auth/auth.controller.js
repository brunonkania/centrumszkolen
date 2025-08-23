import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signJwt } from '../utils/jwt.js';

export async function register(req, res) {
  const { email, password, fullName } = req.body;
  const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rowCount) return res.status(409).json({ message: 'Email już zarejestrowany' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    'INSERT INTO users(email, password_hash, full_name) VALUES($1,$2,$3) RETURNING id,email,full_name',
    [email, hash, fullName]
  );
  const token = signJwt({ userId: rows[0].id });
  res.json({ token, user: rows[0] });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const { rows } = await query('SELECT id,email,password_hash,full_name FROM users WHERE email=$1', [email]);
  if (!rows.length) return res.status(401).json({ message: 'Błędne dane' });
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ message: 'Błędne dane' });
  const token = signJwt({ userId: rows[0].id });
  res.json({ token, user: { id: rows[0].id, email: rows[0].email, full_name: rows[0].full_name } });
}
