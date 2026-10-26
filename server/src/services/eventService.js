import { db, newId, withTransaction } from '../db.js';
import { notFound, badRequest, conflict, forbidden, unprocessable } from '../errors.js';
import { initialRsvpStatus, promotionsNeeded, validateCapacityEdit } from '../domain/waitlist.js';

// Every function takes an optional query wrapper `q`; inside a transaction the
// transaction-scoped wrapper is passed so all reads/writes share one client.

export async function getEvent(eventId, q = db) {
  const event = await q.get('SELECT * FROM events WHERE id = ?', eventId);
  if (!event) throw notFound('Event not found');
  return event;
}

export async function countsFor(eventId, q = db) {
  const going = (await q.get(`SELECT COUNT(*)::int AS n FROM rsvps WHERE event_id = ? AND status = 'going'`, eventId)).n;
  const waitlisted = (await q.get(`SELECT COUNT(*)::int AS n FROM rsvps WHERE event_id = ? AND status = 'waitlisted'`, eventId)).n;
  return { going, waitlisted };
}

export async function eventWithCounts(event, userId = null, q = db) {
  const counts = await countsFor(event.id, q);
  const organizer = await q.get('SELECT id, display_name, avatar_url FROM users WHERE id = ?', event.organizer_id);
  const myRsvp = userId
    ? (await q.get(`SELECT id, status, position FROM rsvps WHERE event_id = ? AND user_id = ? AND status != 'cancelled'`, event.id, userId)) || null
    : null;
  let waitlistPosition = null;
  if (myRsvp?.status === 'waitlisted') {
    waitlistPosition = (await q.get(
      `SELECT COUNT(*)::int AS n FROM rsvps WHERE event_id = ? AND status = 'waitlisted' AND position <= ?`, event.id, myRsvp.position)).n;
  }
  const spotsLeft = event.capacity === null ? null : Math.max(0, event.capacity - counts.going);
  return { ...event, ...counts, spotsLeft, organizer, myRsvp, waitlistPosition };
}

export async function listEvents({ when, q, userId }) {
  const where = [`status = 'published'`];
  const params = [];
  if (when === 'upcoming') { where.push(`starts_at >= now()`); }
  if (when === 'past') { where.push(`starts_at < now()`); }
  if (q) { where.push('(title ILIKE ? OR description ILIKE ? OR location ILIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const order = when === 'past' ? 'DESC' : 'ASC';
  const rows = await db.all(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY starts_at ${order} LIMIT 100`, ...params);
  return Promise.all(rows.map((e) => eventWithCounts(e, userId)));
}

export async function publishEvent(organizerId, { title, description, location, startsAt, endsAt, capacity }) {
  if (!Date.parse(startsAt)) throw badRequest('A valid start time is required');
  if (!Date.parse(endsAt)) throw badRequest('A valid end time is required');
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw badRequest('The event must end after it starts');
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    throw badRequest('Capacity must be a positive whole number (or empty for unlimited)');
  }
  if (Date.parse(startsAt) < Date.now() - 5 * 60 * 1000) throw badRequest('Start time cannot be in the past');
  const id = newId('evt');
  await db.run(
    `INSERT INTO events (id, title, description, location, starts_at, ends_at, capacity, organizer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, title.trim(), (description || '').trim(), (location || '').trim(),
    new Date(startsAt).toISOString(), new Date(endsAt).toISOString(), capacity, organizerId);
  return getEvent(id);
}

/** Lock the event row so capacity checks serialize per event. */
const lockEvent = (q, eventId) => q.get('SELECT id FROM events WHERE id = ? FOR UPDATE', eventId);

/** RSVP in one transaction: capacity check and insert are atomic. */
export async function rsvp(eventId, userId) {
  const event = await getEvent(eventId);
  if (event.status !== 'published') throw conflict('This event has been cancelled');
  if (new Date(event.starts_at).getTime() < Date.now()) throw conflict('This event has already started');
  if (event.organizer_id === userId) throw badRequest('You are the organizer of this event');

  return withTransaction(async (q) => {
    await lockEvent(q, eventId);
    const existing = await q.get('SELECT * FROM rsvps WHERE event_id = ? AND user_id = ?', eventId, userId);
    if (existing && existing.status !== 'cancelled') throw conflict(`You are already ${existing.status}`);
    const { going } = await countsFor(eventId, q);
    const status = initialRsvpStatus(going, event.capacity);
    const position = status === 'waitlisted'
      ? ((await q.get(`SELECT COALESCE(MAX(position), 0) AS m FROM rsvps WHERE event_id = ?`, eventId)).m + 1)
      : 0;
    if (existing) {
      await q.run(`UPDATE rsvps SET status = ?, position = ?, updated_at = now() WHERE id = ?`, status, position, existing.id);
      return { id: existing.id, status, reactivated: true };
    }
    const id = newId('rsvp');
    await q.run(`INSERT INTO rsvps (id, event_id, user_id, status, position) VALUES (?, ?, ?, ?, ?)`, id, eventId, userId, status, position);
    return { id, status, reactivated: false };
  });
}

/** Cancel an RSVP; if a seat opened, promote the waitlist head in the same transaction. */
export async function cancelRsvp(eventId, userId) {
  return withTransaction(async (q) => {
    await lockEvent(q, eventId);
    const rsvpRow = await q.get(`SELECT * FROM rsvps WHERE event_id = ? AND user_id = ? AND status != 'cancelled'`, eventId, userId);
    if (!rsvpRow) throw notFound('No active RSVP found');
    await q.run(`UPDATE rsvps SET status = 'cancelled', updated_at = now() WHERE id = ?`, rsvpRow.id);
    const promoted = rsvpRow.status === 'going' ? await applyPromotions(eventId, q) : [];
    return { cancelled: rsvpRow.id, promoted };
  });
}

export async function applyPromotions(eventId, q = db) {
  const event = await getEvent(eventId, q);
  const { going } = await countsFor(eventId, q);
  const waitlisted = await q.all(
    `SELECT id FROM rsvps WHERE event_id = ? AND status = 'waitlisted' ORDER BY position`, eventId);
  const { promote } = promotionsNeeded(waitlisted, going, event.capacity);
  for (const id of promote) {
    await q.run(`UPDATE rsvps SET status = 'going', position = 0, updated_at = now() WHERE id = ?`, id);
  }
  return promote;
}

export async function editEvent(eventId, userId, patch) {
  const event = await getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can edit this event');
  if (event.status !== 'published') throw conflict('This event has been cancelled');
  const { going } = await countsFor(eventId);
  return withTransaction(async (q) => {
    await lockEvent(q, eventId);
    if (patch.capacity !== undefined) {
      const check = validateCapacityEdit(patch.capacity, going);
      if (!check.ok) throw unprocessable(check.error);
      await q.run('UPDATE events SET capacity = ? WHERE id = ?', patch.capacity, eventId);
    }
    for (const key of ['title', 'description', 'location']) {
      if (patch[key] !== undefined) {
        await q.run(`UPDATE events SET ${key} = ? WHERE id = ?`, String(patch[key]).trim(), eventId);
      }
    }
    if (patch.startsAt) await q.run('UPDATE events SET starts_at = ? WHERE id = ?', new Date(patch.startsAt).toISOString(), eventId);
    if (patch.endsAt) await q.run('UPDATE events SET ends_at = ? WHERE id = ?', new Date(patch.endsAt).toISOString(), eventId);
    const promoted = patch.capacity !== undefined ? await applyPromotions(eventId, q) : [];
    return { promoted };
  });
}

export async function cancelEvent(eventId, userId) {
  const event = await getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can cancel this event');
  await withTransaction(async (q) => {
    await q.run(`UPDATE events SET status = 'cancelled' WHERE id = ?`, eventId);
    await q.run(`UPDATE rsvps SET status = 'cancelled', updated_at = now() WHERE event_id = ? AND status != 'cancelled'`, eventId);
  });
}

export async function attendeeList(eventId, userId) {
  const event = await getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can view the attendee list');
  return db.all(`
    SELECT r.id, r.status, r.position, r.updated_at, u.display_name, u.email, u.avatar_url
    FROM rsvps r JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ? AND r.status != 'cancelled'
    ORDER BY CASE r.status WHEN 'going' THEN 0 ELSE 1 END, r.position, r.created_at
  `, eventId);
}

export async function myRsvps(userId) {
  const rows = await db.all(`
    SELECT e.*, r.status AS rsvp_status, r.position, r.updated_at AS rsvp_updated_at
    FROM rsvps r JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ? AND r.status != 'cancelled'
    ORDER BY e.starts_at
  `, userId);
  return Promise.all(rows.map(async (e) => {
    const withCounts = await eventWithCounts(e, userId);
    return { ...withCounts, rsvpStatus: e.rsvp_status, waitlistPosition: withCounts.waitlistPosition };
  }));
}
