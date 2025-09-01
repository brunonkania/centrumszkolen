// server/src/middleware/audit.js
import { query } from '../db.js';

/**
 * Zapis prostego logu audytowego.
 * @param {Object} opts
 * @param {number|null} opts.userId
 * @param {string} opts.action - np. 'COURSE_CREATE', 'MODULE_UPDATE', 'PAYMENT_CREATE'
 * @param {string} [opts.entity] - np. 'course', 'module', 'order'
 * @param {string|number} [opts.entityId]
 * @param {object} [opts.meta] - dodatkowy kontekst (JSON)
 */
export async function logAudit({ userId = null, action, entity = null, entityId = null, meta = null }) {
  try {
    await query(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5)',
      [userId, action, entity, entityId?.toString?.() ?? null, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) {
    // nie blokujemy żądania jeśli log się nie uda – tylko log do stderr
    console.error('[audit_log]', e?.message || e);
  }
}
