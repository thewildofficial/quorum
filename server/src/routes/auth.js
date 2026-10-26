import { Router } from 'express';
import { db, newId } from '../db.js';
import { badRequest, unauthorized } from '../errors.js';
import { authUrl, exchangeCode, verifyIdToken, enforceDomain } from '../google.js';
import { organizerEmails } from '../middleware/auth.js';

const SESSION_DAYS = 14;
const secureCookie = () => process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false';

export function createAuthRouter(deps = {}) {
  const verify = deps.verifyIdToken || verifyIdToken;
  const exchange = deps.exchangeCode || exchangeCode;
  const router = Router();

  const redirectUri = (req) =>
    process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

  router.get('/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).send('Google sign-in is not configured on this server yet (missing GOOGLE_CLIENT_ID).');
    }
    const state = crypto.randomUUID();
    db.prepare('INSERT INTO oauth_states (state) VALUES (?)').run(state);
    db.prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-15 minutes')`).run();
    // Bind the state to THIS browser: the callback must present the same cookie,
    // so a login started in one browser cannot be completed in another.
    res.cookie('quorum_oauth', state, {
      httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: 15 * 60 * 1000,
    });
    res.redirect(authUrl(redirectUri(req), state));
  });

  router.get('/google/callback', async (req, res, next) => {
    try {
      const { code, state, error } = req.query;
      if (error) throw unauthorized(`Google sign-in was not completed: ${error}`);
      if (!code || !state) throw badRequest('Missing code or state');
      const known = db.prepare('SELECT state FROM oauth_states WHERE state = ?').get(String(state));
      if (!known) throw unauthorized('Invalid or expired sign-in state; try again');
      db.prepare('DELETE FROM oauth_states WHERE state = ?').run(String(state));
      if (req.cookies?.quorum_oauth !== String(state)) {
        throw unauthorized('Sign-in state does not match this browser; start again');
      }
      res.clearCookie('quorum_oauth');

      const tokens = await exchange(String(code), redirectUri(req));
      const claims = await verify(tokens.id_token);
      const identity = enforceDomain(claims);

      const tx = db.transaction(() => {
        let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(identity.sub)
          || db.prepare('SELECT * FROM users WHERE email = ?').get(identity.email);
        const role = organizerEmails().includes(identity.email.toLowerCase()) ? 'organizer' : 'member';
        if (!user) {
          const id = newId('usr');
          db.prepare('INSERT INTO users (id, google_sub, email, display_name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, identity.sub, identity.email, identity.name, identity.picture || '', role);
          return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }
        // Role always reflects the current allowlist - no sticky organizer.
        db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, role = ? WHERE id = ?')
          .run(identity.name, identity.picture || '', role, user.id);
        return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      });
      const user = tx();

      const token = crypto.randomUUID() + crypto.randomUUID();
      db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
        .run(token, user.id);
      res.cookie('quorum_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie(),
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
      });
      res.redirect('/');
    } catch (e) { next(e); }
  });

  router.post('/logout', (req, res) => {
    if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    res.clearCookie('quorum_session');
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user || null, allowedDomain: process.env.ALLOWED_GOOGLE_DOMAIN || 'sst.scaler.com' });
  });

  return router;
}
