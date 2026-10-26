import { db, newId } from '../db.js';
import { notFound, badRequest, conflict, forbidden, unprocessable } from '../errors.js';
import { initialRsvpStatus, promotionsNeeded, validateCapacityEdit } from '../domain/waitlist.js';

export function getEvent(eventId) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) throw notFound('Event not found');
  return event;
}

export function countsFor(eventId) {
  const going = db.prepare(`SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ? AND status = 'going'`).get(eventId).n;
  const waitlisted = db.prepare(`SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ? AND status = 'waitlisted'`).get(eventId).n;
  return { going, waitlisted };
}

export function eventWithCounts(event, userId = null) {
  const counts = countsFor(event.id);
  const organizer = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(event.organizer_id);
  const myRsvp = userId
    ? db.prepare(`SELECT id, status, position FROM rsvps WHERE event_id = ? AND user_id = ? AND status != 'cancelled'`).get(event.id, userId) || null
    : null;
  let waitlistPosition = null;
  if (myRsvp?.status === 'waitlisted') {
    waitlistPosition = db.prepare(
      `SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ? AND status = 'waitlisted' AND position <= ?`
    ).get(event.id, myRsvp.position).n;
  }
  const spotsLeft = event.capacity === null ? null : Math.max(0, event.capacity - counts.going);
  return { ...event, ...counts, spotsLeft, organizer, myRsvp, waitlistPosition };
}

export function listEvents({ when, q, userId }) {
  const where = [`status = 'published'`];
  const params = [];
  if (when === 'upcoming') { where.push(`starts_at >= datetime('now')`); }
  if (when === 'past') { where.push(`starts_at < datetime('now')`); }
  if (q) { where.push('(title LIKE ? OR description LIKE ? OR location LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const order = when === 'past' ? 'DESC' : 'ASC';
  const rows = db.prepare(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY starts_at ${order} LIMIT 100`).all(...params);
  return rows.map((e) => eventWithCounts(e, userId));
}

export function publishEvent(organizerId, { title, description, location, startsAt, endsAt, capacity }) {
  if (!Number.isNaN(Date.parse(startsAt)) === false || !Date.parse(startsAt)) throw badRequest('A valid start time is required');
  if (!Date.parse(endsAt)) throw badRequest('A valid end time is required');
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw badRequest('The event must end after it starts');
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    throw badRequest('Capacity must be a positive whole number (or empty for unlimited)');
  }
  if (Date.parse(startsAt) < Date.now() - 5 * 60 * 1000) throw badRequest('Start time cannot be in the past');
  const id = newId('evt');
  const toIso = (d) => new Date(d).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(
    `INSERT INTO events (id, title, description, location, starts_at, ends_at, capacity, organizer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title.trim(), (description || '').trim(), (location || '').trim(), toIso(startsAt), toIso(endsAt), capacity, organizerId);
  return getEvent(id);
}

/** RSVP in one transaction: capacity check and insert are atomic. */
export function rsvp(eventId, userId) {
  const event = getEvent(eventId);
  if (event.status !== 'published') throw conflict('This event has been cancelled');
  if (Date.parse(event.starts_at.replace(' ', 'T') + 'Z') < Date.now()) throw conflict('This event has already started');
  if (event.organizer_id === userId) throw badRequest('You are the organizer of this event');

  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND user_id = ?').get(eventId, userId);
    if (existing && existing.status !== 'cancelled') throw conflict(`You are already ${existing.status}`);
    const { going } = countsFor(eventId);
    const status = initialRsvpStatus(going, event.capacity);
    const position = status === 'waitlisted'
      ? (db.prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM rsvps WHERE event_id = ?`).get(eventId).m + 1)
      : 0;
    if (existing) {
      db.prepare(`UPDATE rsvps SET status = ?, position = ?, updated_at = datetime('now') WHERE id = ?`).run(status, position, existing.id);
      return { id: existing.id, status, reactivated: true };
    }
    const id = newId('rsvp');
    db.prepare(`INSERT INTO rsvps (id, event_id, user_id, status, position) VALUES (?, ?, ?, ?, ?)`).run(id, eventId, userId, status, position);
    return { id, status, reactivated: false };
  });
  return tx();
}

/** Cancel an RSVP; if a seat opened, promote the waitlist head in the same transaction. */
export function cancelRsvp(eventId, userId) {
  const tx = db.transaction(() => {
    const rsvpRow = db.prepare(`SELECT * FROM rsvps WHERE event_id = ? AND user_id = ? AND status != 'cancelled'`).get(eventId, userId);
    if (!rsvpRow) throw notFound('No active RSVP found');
    db.prepare(`UPDATE rsvps SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(rsvpRow.id);
    let promoted = [];
    if (rsvpRow.status === 'going') {
      promoted = applyPromotions(eventId);
    }
    return { cancelled: rsvpRow.id, promoted };
  });
  return tx();
}

export function applyPromotions(eventId) {
  const event = getEvent(eventId);
  const { going } = countsFor(eventId);
  const waitlisted = db.prepare(
    `SELECT id FROM rsvps WHERE event_id = ? AND status = 'waitlisted' ORDER BY position`
  ).all(eventId);
  const { promote } = promotionsNeeded(waitlisted, going, event.capacity);
  for (const id of promote) {
    db.prepare(`UPDATE rsvps SET status = 'going', position = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  }
  return promote;
}

export function editEvent(eventId, userId, patch) {
  const event = getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can edit this event');
  if (event.status !== 'published') throw conflict('This event has been cancelled');
  const { going } = countsFor(eventId);
  const tx = db.transaction(() => {
    if (patch.capacity !== undefined) {
      const check = validateCapacityEdit(patch.capacity, going);
      if (!check.ok) throw unprocessable(check.error);
      db.prepare('UPDATE events SET capacity = ? WHERE id = ?').run(patch.capacity, eventId);
    }
    for (const key of ['title', 'description', 'location']) {
      if (patch[key] !== undefined) {
        db.prepare(`UPDATE events SET ${key} = ? WHERE id = ?`).run(String(patch[key]).trim(), eventId);
      }
    }
    if (patch.startsAt) db.prepare('UPDATE events SET starts_at = ? WHERE id = ?').run(new Date(patch.startsAt).toISOString().slice(0, 19).replace('T', ' '), eventId);
    if (patch.endsAt) db.prepare('UPDATE events SET ends_at = ? WHERE id = ?').run(new Date(patch.endsAt).toISOString().slice(0, 19).replace('T', ' '), eventId);
    const promoted = patch.capacity !== undefined ? applyPromotions(eventId) : [];
    return { promoted };
  });
  return tx();
}

export function cancelEvent(eventId, userId) {
  const event = getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can cancel this event');
  const tx = db.transaction(() => {
    db.prepare(`UPDATE events SET status = 'cancelled' WHERE id = ?`).run(eventId);
    db.prepare(`UPDATE rsvps SET status = 'cancelled', updated_at = datetime('now') WHERE event_id = ? AND status != 'cancelled'`).run(eventId);
  });
  tx();
}

export function attendeeList(eventId, userId) {
  const event = getEvent(eventId);
  if (event.organizer_id !== userId) throw forbidden('Only the organizer can view the attendee list');
  const rows = db.prepare(`
    SELECT r.id, r.status, r.position, r.updated_at, u.display_name, u.email, u.avatar_url
    FROM rsvps r JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ? AND r.status != 'cancelled'
    ORDER BY CASE r.status WHEN 'going' THEN 0 ELSE 1 END, r.position, r.created_at
  `).all(eventId);
  return rows;
}

export function myRsvps(userId) {
  const rows = db.prepare(`
    SELECT e.*, r.status AS rsvp_status, r.position, r.updated_at AS rsvp_updated_at
    FROM rsvps r JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ? AND r.status != 'cancelled'
    ORDER BY e.starts_at
  `).all(userId);
  return rows.map((e) => {
    const withCounts = eventWithCounts(e, userId);
    return { ...withCounts, rsvpStatus: e.rsvp_status, waitlistPosition: withCounts.waitlistPosition };
  });
}
