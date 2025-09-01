// src/middleware/validate.js
import { z } from 'zod';

export function validate({ params, query, body } = {}) {
  return (req, res, next) => {
    try {
      if (params) {
        const p = params.parse ? params.parse(req.params) : z.object(params).parse(req.params);
        req.params = p;
      }
      if (query) {
        const q = query.parse ? query.parse(req.query) : z.object(query).parse(req.query);
        req.query = q;
      }
      if (body) {
        const b = body.parse ? body.parse(req.body) : z.object(body).parse(req.body);
        req.body = b;
      }
      next();
    } catch (e) {
      e.status = 400;
      e.code = 'INVALID_INPUT';
      next(e);
    }
  };
}
