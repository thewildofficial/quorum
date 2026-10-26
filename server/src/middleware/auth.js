import { db } from '../db.js';
import { unauthorized, forbidden } from '../errors.js';

// Organizer authority is the CURRENT environment allowlist, checked on every
// request - removing an email revokes access immediately, even for live sessions.
export const organizerEmails = () =>
  (process.env.ORGANIZER_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function attachUser(req, _res, next) {
  try {
    const token = req.cookies?.quorum_session;
    if (token) {
      const row = await db.get(
        `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > now()`, token);
      if (row) {
        // Role reflects the CURRENT allowlist on every request, so revocation is
        // immediate even for sessions issued while the email was listed.
        const role = organizerEmails().includes(row.email.toLowerCase()) ? 'organizer' : 'member';
        req.user = { id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, role };
        req.sessionToken = token;
      }
    }
    next();
  } catch (e) { next(e); }
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
