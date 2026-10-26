// Seeds synthetic members, an organizer, and sample events so evaluators can
// explore discovery immediately. All people and events below are fictional.
// Seeded users cannot log in (no Google account); they exist to populate lists.
import { db, newId } from './db.js';
import { initialRsvpStatus } from './domain/waitlist.js';

const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (count > 0) {
  console.log('[seed] database already has users; skipping');
  process.exit(0);
}

function addUser(name, email, role) {
  const id = newId('usr');
  db.prepare('INSERT INTO users (id, google_sub, email, display_name, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, `seed-${email}`, email, name, role);
  return id;
}

const organizer = addUser('Demo Organizer', 'organizer@seed.quorum.local', 'organizer');
const members = Array.from({ length: 8 }, (_, i) => addUser(`Demo Member ${i + 1}`, `member${i + 1}@seed.quorum.local`, 'member'));

function addEvent({ title, description, location, inDays, hour, durationH, capacity, filled = 0 }) {
  const id = newId('evt');
  const start = new Date(Date.now() + inDays * 86400000);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationH * 3600000);
  const toIso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(
    `INSERT INTO events (id, title, description, location, starts_at, ends_at, capacity, organizer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, description, location, toIso(start), toIso(end), capacity, organizer);
  for (let i = 0; i < filled && i < members.length; i++) {
    const going = db.prepare(`SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ? AND status = 'going'`).get(id).n;
    const status = initialRsvpStatus(going, capacity);
    const position = status === 'waitlisted'
      ? db.prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM rsvps WHERE event_id = ?`).get(id).m + 1
      : 0;
    db.prepare('INSERT INTO rsvps (id, event_id, user_id, status, position) VALUES (?, ?, ?, ?, ?)')
      .run(newId('rsvp'), id, members[i], status, position);
  }
  return id;
}

addEvent({
  title: 'Intro to Mechanistic Interpretability',
  description: 'A guided tour of what transformer circuits are, why features matter, and a live walkthrough of a small sparse autoencoder. Bring a laptop if you want to follow along.',
  location: 'Seminar Hall 2, SST Campus',
  inDays: 5, hour: 16, durationH: 2, capacity: 40, filled: 6,
});
addEvent({
  title: 'Paper Reading: World Models',
  description: 'We read Ha & Schmidhuber plus one recent follow-up, and discuss what world-modeling buys an agent. Reading list goes out two days before.',
  location: 'Discord Stage + Library Room 3',
  inDays: 9, hour: 18, durationH: 1.5, capacity: 15, filled: 8,
});
addEvent({
  title: 'Build Night: Evals Hackathon',
  description: 'Three hours, teams of two, one capability eval each. We provide the rubric and the models; you bring the skepticism. Pizza at 8.',
  location: 'Innovation Lab',
  inDays: 12, hour: 17, durationH: 3, capacity: 24, filled: 7,
});
addEvent({
  title: 'Alignment Talk + Open Q&A',
  description: 'A member talk on why AI alignment is a technical problem, followed by open questions. First in the Term 2 speaker series.',
  location: 'Main Auditorium',
  inDays: 15, hour: 15, durationH: 2, capacity: null, filled: 5,
});
addEvent({
  title: 'Tiny Transformers from Scratch',
  description: 'Implement a two-layer transformer in pure NumPy in one sitting. Attendance capped for hands-on mentoring.',
  location: 'Lab 4',
  inDays: 7, hour: 14, durationH: 4, capacity: 3, filled: 5, // deliberately over-subscribed: 3 going, 2 waitlisted
});
addEvent({
  title: 'Club Showcase (past)',
  description: 'End-of-term demo afternoon from last term.',
  location: 'Atrium',
  inDays: -10, hour: 13, durationH: 3, capacity: null, filled: 4,
});
console.log('[seed] inserted 1 organizer, 8 members, 6 events');
