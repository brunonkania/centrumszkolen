// src/middleware/audit.js
import { query } from '../db.js';

export async function logAudit({ userId = null, action, entity = null, entityId = null, meta = {} }) {
  try {
    await query(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5)',
      [userId, action, entity, entityId, meta]
    );
  } catch (e) {
    // nie blokuj flow aplikacji
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error('audit failed', e.message);
    }
  }
}
