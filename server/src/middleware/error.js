export function notFound(req, res, next) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const body = {
    error: err.code || 'INTERNAL_ERROR',
    message: err.expose ? err.message : 'Unexpected server error',
  };
  if (req.app.get('env') === 'development') {
    body.details = err.stack;
  }
  res.status(status).json(body);
}
