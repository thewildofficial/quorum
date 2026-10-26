// Google OAuth: authorization-code flow with server-side ID-token verification.
// The SST-domain restriction is enforced here, on the verified token - never
// on a user-supplied email string.
import { unauthorized } from './errors.js';

const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN || 'sst.scaler.com';

export function authUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    hd: ALLOWED_DOMAIN, // pre-filters Google's account chooser; enforcement happens in verifyIdToken
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw unauthorized('Google sign-in failed at token exchange');
  return res.json();
}

/**
 * Verify a Google ID token server-side (signature/audience via Google's
 * tokeninfo endpoint). Returns raw claims. Domain policy is enforced
 * separately in enforceDomain() so it can never be bypassed by swapping
 * the verifier (e.g. in tests).
 */
export async function verifyIdToken(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw unauthorized('Google ID token verification failed');
  const claims = await res.json();
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw unauthorized('Token was not issued for this application');
  return claims;
}

/**
 * The SST restriction, enforced on verified claims in the login callback:
 * the token's `hd` claim (present on Google Workspace accounts) must equal
 * the allowed domain. Tokens without `hd` are rejected even if the email
 * looks right - a suffix match is not proof of workspace membership.
 */
export function enforceDomain(claims) {
  if (claims.email_verified !== 'true' && claims.email_verified !== true) {
    throw unauthorized('Google account email is not verified');
  }
  if (claims.hd !== ALLOWED_DOMAIN) {
    throw unauthorized(`Sign-in is restricted to @${ALLOWED_DOMAIN} Google accounts`);
  }
  return { sub: claims.sub, email: claims.email, name: claims.name || claims.email, picture: claims.picture || '' };
}
