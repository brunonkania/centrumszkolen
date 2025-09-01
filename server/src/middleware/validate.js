export const validate = ({ body, params, query } = {}) => (req, res, next) => {
  try {
    if (body) req.body = body.parse(req.body);
    if (params) req.params = params.parse(req.params);
    if (query) req.query = query.parse(req.query);
    next();
  } catch (e) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Nieprawidłowe dane wejściowe',
      details: e?.errors || e?.message,
    });
  }
};
