// API integration tests on an isolated DB. Google verification is stubbed via
// dependency injection - the production path verifies real Google ID tokens.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-test-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.db');
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.ORGANIZER_EMAILS = 'prof@sst.scaler.com';

const { createApp } = await import('../src/app.js');

let server; let base;
const cookies = {}; // per-persona cookie jar

const fakeVerify = async (token) => JSON.parse(Buffer.from(token, 'base64url').toString());
const fakeExchange = async (code) => ({ id_token: code });

async function login(email, name = 'Test User') {
  // Get a state value through the real redirect endpoint
  const r1 = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  const location = r1.headers.get('location');
  const state = new URL(location).searchParams.get('state');
  const code = Buffer.from(JSON.stringify({ sub: 'sub-' + email, email, name, email_verified: 'true', iss: 'https://accounts.google.com', hd: 'sst.scaler.com', aud: 'test-client-id' })).toString('base64url');
  const r2 = await fetch(base + `/api/auth/google/callback?code=${code}&state=${state}`, { redirect: 'manual' });
  assert.equal(r2.status, 302);
  cookies[email] = r2.headers.get('set-cookie').split(';')[0];
}

async function api(email, method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(email ? { cookie: cookies[email] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

before(async () => {
  server = createApp({ verifyIdToken: fakeVerify, exchangeCode: fakeExchange }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const future = (h) => new Date(Date.now() + h * 3600000).toISOString();
let eventId;

test('wrong-domain sign-in is rejected even with a plausible email', async () => {
  const r1 = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  const state = new URL(r1.headers.get('location')).searchParams.get('state');
  const code = Buffer.from(JSON.stringify({ sub: 'sub-out', email: 'someone@gmail.com', name: 'Out', email_verified: 'true', iss: 'https://accounts.google.com', hd: 'gmail.com', aud: 'test-client-id' })).toString('base64url');
  const r2 = await fetch(base + `/api/auth/google/callback?code=${code}&state=${state}`, { redirect: 'manual' });
  // error handler renders JSON, not a session
  assert.notEqual(r2.status, 302);
  assert.equal(r2.headers.get('set-cookie'), null);
});

test('token from a non-Google issuer is rejected even with the right domain', async () => {
  const r1 = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  const state = new URL(r1.headers.get('location')).searchParams.get('state');
  const code = Buffer.from(JSON.stringify({ sub: 'sub-evil', email: 'prof@sst.scaler.com', name: 'Evil', email_verified: 'true', iss: 'https://evil.example.com', hd: 'sst.scaler.com', aud: 'test-client-id' })).toString('base64url');
  const r2 = await fetch(base + `/api/auth/google/callback?code=${code}&state=${state}`, { redirect: 'manual' });
  assert.notEqual(r2.status, 302);
  assert.equal(r2.headers.get('set-cookie'), null);
});

test('login assigns organizer role from allowlist', async () => {
  await login('prof@sst.scaler.com', 'Prof');
  await login('student@sst.scaler.com', 'Stu Dent');
  const me = await api('prof@sst.scaler.com', 'GET', '/api/auth/me');
  assert.equal(me.json.user.role, 'organizer');
  const me2 = await api('student@sst.scaler.com', 'GET', '/api/auth/me');
  assert.equal(me2.json.user.role, 'member');
});

test('only organizers can publish; validation enforced', async () => {
  let r = await api('student@sst.scaler.com', 'POST', '/api/events', { title: 'X', startsAt: future(2), endsAt: future(3) });
  assert.equal(r.status, 403);
  r = await api('prof@sst.scaler.com', 'POST', '/api/events', { title: 'X', startsAt: future(3), endsAt: future(2) });
  assert.equal(r.status, 400, 'end before start rejected');
  r = await api('prof@sst.scaler.com', 'POST', '/api/events', {
    title: 'Tiny Workshop', description: 'd', location: 'Lab', startsAt: future(24), endsAt: future(26), capacity: 2,
  });
  assert.equal(r.status, 201);
  eventId = r.json.event.id;
});

test('rsvp fills to capacity then waitlists in order', async () => {
  await login('s1@sst.scaler.com', 'S1'); await login('s2@sst.scaler.com', 'S2'); await login('s3@sst.scaler.com', 'S3');
  let r = await api('s1@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp`);
  assert.equal(r.json.rsvp.status, 'going');
  r = await api('s2@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp`);
  assert.equal(r.json.rsvp.status, 'going');
  r = await api('s3@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp`);
  assert.equal(r.json.rsvp.status, 'waitlisted');
  assert.equal(r.json.event.waitlistPosition, 1);
  r = await api('s3@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp`);
  assert.equal(r.status, 409, 'duplicate RSVP rejected');
});

test('cancellation promotes the waitlist head', async () => {
  const r = await api('s1@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp/cancel`);
  assert.equal(r.json.promotedCount, 1);
  const d = await api('s3@sst.scaler.com', 'GET', `/api/events/${eventId}`);
  assert.equal(d.json.event.myRsvp.status, 'going', 's3 promoted');
  assert.equal(d.json.event.going, 2);
});

test('capacity edits validate and promote on increase', async () => {
  let r = await api('s2@sst.scaler.com', 'PATCH', `/api/events/${eventId}`, { capacity: 1 });
  assert.equal(r.status, 403, 'non-organizer cannot edit');
  r = await api('prof@sst.scaler.com', 'PATCH', `/api/events/${eventId}`, { capacity: 1 });
  assert.equal(r.status, 422, 'cannot shrink below going count');
  r = await api('s1@sst.scaler.com', 'POST', `/api/events/${eventId}/rsvp`);
  assert.equal(r.json.rsvp.status, 'waitlisted');
  r = await api('prof@sst.scaler.com', 'PATCH', `/api/events/${eventId}`, { capacity: 3 });
  assert.equal(r.json.promotedCount, 1, 'increase promotes waitlist head');
});

test('attendee list is organizer-only', async () => {
  let r = await api('s1@sst.scaler.com', 'GET', `/api/events/${eventId}/attendees`);
  assert.equal(r.status, 403);
  r = await api('prof@sst.scaler.com', 'GET', `/api/events/${eventId}/attendees`);
  assert.equal(r.status, 200);
  assert.ok(r.json.attendees.length >= 3);
});

test('public discovery works without login; mine requires auth', async () => {
  let r = await api(null, 'GET', '/api/events');
  assert.equal(r.status, 200);
  assert.ok(r.json.events.length >= 1);
  r = await api(null, 'GET', '/api/events/mine/rsvps');
  assert.equal(r.status, 401);
  r = await api(null, 'GET', `/api/events?q=tiny`);
  assert.equal(r.json.events.length, 1);
});

test('event cancellation cancels all rsvps', async () => {
  const r = await api('prof@sst.scaler.com', 'POST', `/api/events/${eventId}/cancel`);
  assert.equal(r.status, 200);
  const d = await api('s2@sst.scaler.com', 'GET', `/api/events/${eventId}`);
  assert.equal(d.json.event.status, 'cancelled');
  const mine = await api('s2@sst.scaler.com', 'GET', '/api/events/mine/rsvps');
  assert.equal(mine.json.events.length, 0);
});
