import { ApiError } from '../errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error('[deliberate] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
