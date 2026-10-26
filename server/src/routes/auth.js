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
  const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  const redirectUri = (req) =>
    process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

  router.get('/google', ah(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).send('Google sign-in is not configured on this server yet (missing GOOGLE_CLIENT_ID).');
    }
    const state = crypto.randomUUID();
    await db.run('INSERT INTO oauth_states (state) VALUES (?)', state);
    await db.run(`DELETE FROM oauth_states WHERE created_at < now() - interval '15 minutes'`);
    // Bind the state to THIS browser: the callback must present the same cookie,
    // so a login started in one browser cannot be completed in another.
    res.cookie('quorum_oauth', state, {
      httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: 15 * 60 * 1000,
    });
    res.redirect(authUrl(redirectUri(req), state));
  }));

  router.get('/google/callback', ah(async (req, res) => {
    const { code, state, error } = req.query;
    if (error) throw unauthorized(`Google sign-in was not completed: ${error}`);
    if (!code || !state) throw badRequest('Missing code or state');
    const known = await db.get('SELECT state FROM oauth_states WHERE state = ?', String(state));
    if (!known) throw unauthorized('Invalid or expired sign-in state; try again');
    await db.run('DELETE FROM oauth_states WHERE state = ?', String(state));
    if (req.cookies?.quorum_oauth !== String(state)) {
      throw unauthorized('Sign-in state does not match this browser; start again');
    }
    res.clearCookie('quorum_oauth');

    const tokens = await exchange(String(code), redirectUri(req));
    const claims = await verify(tokens.id_token);
    const identity = enforceDomain(claims);

    const role = organizerEmails().includes(identity.email.toLowerCase()) ? 'organizer' : 'member';
    const user = await (async () => {
      const existing = (await db.get('SELECT * FROM users WHERE google_sub = ?', identity.sub))
        || (await db.get('SELECT * FROM users WHERE lower(email) = lower(?)', identity.email));
      if (!existing) {
        const id = newId('usr');
        await db.run('INSERT INTO users (id, google_sub, email, display_name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)',
          id, identity.sub, identity.email, identity.name, identity.picture || '', role);
        return db.get('SELECT * FROM users WHERE id = ?', id);
      }
      // Role always reflects the current allowlist - no sticky organizer.
      await db.run('UPDATE users SET display_name = ?, avatar_url = ?, role = ? WHERE id = ?',
        identity.name, identity.picture || '', role, existing.id);
      return db.get('SELECT * FROM users WHERE id = ?', existing.id);
    })();

    const token = crypto.randomUUID() + crypto.randomUUID();
    await db.run(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, now() + interval '${SESSION_DAYS} days')`,
      token, user.id);
    res.cookie('quorum_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie(),
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
    res.redirect('/');
  }));

  router.post('/logout', ah(async (req, res) => {
    if (req.sessionToken) await db.run('DELETE FROM sessions WHERE token = ?', req.sessionToken);
    res.clearCookie('quorum_session');
    res.json({ ok: true });
  }));

  router.get('/me', (req, res) => {
    res.json({ user: req.user || null, allowedDomain: process.env.ALLOWED_GOOGLE_DOMAIN || 'sst.scaler.com' });
  });

  return router;
}
