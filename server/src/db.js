import pg from 'pg';
import { DATABASE_URL } from './config.js';

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// Główna funkcja zapytań – zgodna z nazwą 'query'
export const query = (text, params) => pool.query(text, params);

// Alias kompatybilności (jeśli gdzieś używasz 'q')
export const q = query;
