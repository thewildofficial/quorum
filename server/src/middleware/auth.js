import { db } from '../db.js';
import { unauthorized, forbidden } from '../errors.js';

export function attachUser(req, _res, next) {
  const token = req.cookies?.quorum_session;
  if (token) {
    const row = db.prepare(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    ).get(token);
    if (row) {
      req.user = { id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, role: row.role };
      req.sessionToken = token;
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireOrganizer(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'organizer') return next(forbidden('Only organizers can do this'));
  next();
}
