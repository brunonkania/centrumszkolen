// src/middleware/error.js
export function notFound(_req, res, _next) {
  res.status(404).json({ error: 'NOT_FOUND' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL';
  const msg = err.message || 'Server error';
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[ERR]', { status, code, msg, stack: err.stack });
  }
  res.status(status).json({ error: code, message: msg });
}
