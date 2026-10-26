# SQLite -> Postgres migration prep (Option A: Render free web + Neon free)

Status: PREP ONLY on this branch. main stays on SQLite until the project owner
approves the deployment route. No Neon/Render accounts created.

## Schema (Postgres dialect)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','organizer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 1),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','cancelled')),
  organizer_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','waitlisted','cancelled')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_events_starts ON events(status, starts_at);
CREATE INDEX idx_rsvps_event ON rsvps(event_id, status, position);
CREATE INDEX idx_rsvps_user ON rsvps(user_id, status);
```

## SQLite-isms to replace (inventory from server/src)

- `datetime('now')` -> `now()`; `datetime('now', '+14 days')` -> `now() + interval '14 days'`;
  `datetime('now', '-15 minutes')` -> `now() - interval '15 minutes'`.
- Email uniqueness relied on SQLite `COLLATE NOCASE` -> use `CITEXT` or a
  functional unique index on `lower(email)`.
- better-sqlite3 is synchronous; `pg` is async. Every call site in db.js,
  middleware/auth.js, routes/, services/ becomes await-ed. The RSVP/waitlist
  transactions become `BEGIN/COMMIT` over a single pooled client
  (`client.query('BEGIN')` ... ) keeping the same atomicity story; better:
  `SELECT ... FOR UPDATE` on the event row to serialize capacity checks.
- `db.transaction(fn)` helper maps to an explicit client transaction wrapper.
- Driver: `pg` (node-postgres) with `PG_CONNECTION_STRING` env; Neon provides
  the connection string (use `-pooler` host + `?sslmode=require`).
- Tests: spin a disposable Postgres (docker `postgres:17`) or keep a SQLite
  test double behind the same data-access interface; the service-level tests
  (capacity/waitlist/promotion) must run against REAL Postgres before launch.

## Non-goals on this branch

No driver swap, no account creation, no deploy. main remains shippable as-is.
