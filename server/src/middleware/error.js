// Globalny handler błędów JSON
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    ok: false,
    error: {
      message: status === 500 ? 'Internal Server Error' : err.message,
      code: err.code || undefined
    }
  };
  // log
  console.error('[ERR]', err.stack || err);
  res.status(status).json(payload);
}
