import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { completeModuleParams, completeModuleBody } from '../schemas/progress.js';
import { query } from '../db.js'; // <- masz już taką funkcję

const router = Router();

// Uwaga: wymagany middleware auth, który ustawia req.user.id
// router.use(requireAuth);

router.post(
  '/:courseId/complete',
  validate({ params: completeModuleParams, body: completeModuleBody }),
  async (req, res, next) => {
    const userId = req.user?.id; // MUSI istnieć
    if (!userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const { courseId } = req.params;
    const { moduleIndex } = req.body;

    // TODO: jeśli masz tabelę purchases / access – zweryfikuj dostęp:
    // const hasAccess = await query('SELECT 1 FROM purchases WHERE user_id=$1 AND course_id=$2 AND status=$3', [userId, courseId, 'paid']);

    try {
      await query('BEGIN');

      // zablokuj wiersz postępu (lub sprawdź istniejący)
      const progRes = await query(
        `SELECT id, last_completed_index
           FROM progress
          WHERE user_id = $1 AND course_id = $2
          FOR UPDATE`,
        [userId, courseId]
      );

      let last = -1;
      if (progRes.rowCount) {
        last = progRes.rows[0].last_completed_index ?? -1;
      }

      if (moduleIndex !== last + 1) {
        await query('ROLLBACK');
        return res.status(409).json({
          error: 'INVALID_PROGRESS_ORDER',
          message: `Oczekiwany moduł: ${last + 1}, otrzymano: ${moduleIndex}`,
        });
      }

      if (progRes.rowCount) {
        await query(
          `UPDATE progress
              SET last_completed_index = $1, updated_at = now()
            WHERE id = $2`,
          [moduleIndex, progRes.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO progress (user_id, course_id, last_completed_index, created_at, updated_at)
           VALUES ($1, $2, $3, now(), now())`,
          [userId, courseId, moduleIndex]
        );
      }

      await query('COMMIT');
      return res.json({ ok: true, lastCompletedIndex: moduleIndex });
    } catch (err) {
      try { await query('ROLLBACK'); } catch {}
      return next(err);
    }
  }
);

export default router;
