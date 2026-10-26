// Seeds synthetic members, an organizer, and sample events so evaluators can
// explore discovery immediately. All people and events below are fictional.
// Seeded users cannot log in (no Google account); they exist to populate lists.
import { db, initDb, newId } from './db.js';
import { initialRsvpStatus } from './domain/waitlist.js';

// Demo events are at SST in Bengaluru (IST, UTC+5:30) regardless of the host's
// timezone: anchor the calendar date in the IST frame, then return the UTC
// instant matching the intended IST wall-clock hour.
export const IST_OFFSET_MS = 5.5 * 3600000;
export function seedStartInstant(inDays, hour, now = Date.now()) {
  const d = new Date(now + inDays * 86400000 + IST_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + hour * 3600000 - IST_OFFSET_MS);
}

export async function seedIfEmpty() {
  const count = (await db.get('SELECT COUNT(*)::int AS n FROM users')).n;
  if (count > 0) {
    console.log('[seed] database already has users; skipping');
    return false;
  }

  async function addUser(name, email, role) {
    const id = newId('usr');
    await db.run('INSERT INTO users (id, google_sub, email, display_name, role) VALUES (?, ?, ?, ?, ?)',
      id, `seed-${email}`, email, name, role);
    return id;
  }

  const organizer = await addUser('Demo Organizer', 'organizer@seed.quorum.local', 'organizer');
  const members = [];
  for (let i = 0; i < 8; i++) {
    members.push(await addUser(`Demo Member ${i + 1}`, `member${i + 1}@seed.quorum.local`, 'member'));
  }

  async function addEvent({ title, description, location, inDays, hour, durationH, capacity, filled = 0 }) {
    const id = newId('evt');
    const start = seedStartInstant(inDays, hour);
    const end = new Date(start.getTime() + durationH * 3600000);
    await db.run(
      `INSERT INTO events (id, title, description, location, starts_at, ends_at, capacity, organizer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, title, description, location, start.toISOString(), end.toISOString(), capacity, organizer);
    for (let i = 0; i < filled && i < members.length; i++) {
      const going = (await db.get(`SELECT COUNT(*)::int AS n FROM rsvps WHERE event_id = ? AND status = 'going'`, id)).n;
      const status = initialRsvpStatus(going, capacity);
      const position = status === 'waitlisted'
        ? (await db.get(`SELECT COALESCE(MAX(position), 0) AS m FROM rsvps WHERE event_id = ?`, id)).m + 1
        : 0;
      await db.run('INSERT INTO rsvps (id, event_id, user_id, status, position) VALUES (?, ?, ?, ?, ?)',
        newId('rsvp'), id, members[i], status, position);
    }
    return id;
  }

  await addEvent({
    title: 'Intro to Mechanistic Interpretability',
    description: 'A guided tour of what transformer circuits are, why features matter, and a live walkthrough of a small sparse autoencoder. Bring a laptop if you want to follow along.',
    location: 'Seminar Hall 2, SST Campus',
    inDays: 5, hour: 16, durationH: 2, capacity: 40, filled: 6,
  });
  await addEvent({
    title: 'Paper Reading: World Models',
    description: 'We read Ha & Schmidhuber plus one recent follow-up, and discuss what world-modeling buys an agent. Reading list goes out two days before.',
    location: 'Discord Stage + Library Room 3',
    inDays: 9, hour: 18, durationH: 1.5, capacity: 15, filled: 8,
  });
  await addEvent({
    title: 'Build Night: Evals Hackathon',
    description: 'Three hours, teams of two, one capability eval each. We provide the rubric and the models; you bring the skepticism. Pizza at 8.',
    location: 'Innovation Lab',
    inDays: 12, hour: 17, durationH: 3, capacity: 24, filled: 7,
  });
  await addEvent({
    title: 'Alignment Talk + Open Q&A',
    description: 'A member talk on why AI alignment is a technical problem, followed by open questions. First in the Term 2 speaker series.',
    location: 'Main Auditorium',
    inDays: 15, hour: 15, durationH: 2, capacity: null, filled: 5,
  });
  await addEvent({
    title: 'Tiny Transformers from Scratch',
    description: 'Implement a two-layer transformer in pure NumPy in one sitting. Attendance capped for hands-on mentoring.',
    location: 'Lab 4',
    inDays: 7, hour: 14, durationH: 4, capacity: 3, filled: 5, // deliberately over-subscribed: 3 going, 2 waitlisted
  });
  await addEvent({
    title: 'Club Showcase (past)',
    description: 'End-of-term demo afternoon from last term.',
    location: 'Atrium',
    inDays: -10, hour: 13, durationH: 3, capacity: null, filled: 4,
  });
  console.log('[seed] inserted 1 organizer, 8 members, 6 events');
  return true;
}

// Run directly: node server/src/seed.js
if (import.meta.url === `file://${process.argv[1]}`) {
  await initDb();
  await seedIfEmpty();
  process.exit(0);
}
