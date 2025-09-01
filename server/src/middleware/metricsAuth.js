// server/src/middleware/metricsAuth.js
export function requireMetricsAuth(req, res, next) {
  const token = process.env.METRICS_TOKEN || '';
  if (!token) {
    // Jeśli nie ustawiono METRICS_TOKEN – wpuszczamy (np. lokalnie)
    return next();
  }
  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== token) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
}
