import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'quorum.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','organizer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 1),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','cancelled')),
  organizer_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','waitlisted','cancelled')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_id, status, position);
CREATE INDEX IF NOT EXISTS idx_rsvps_user ON rsvps(user_id, status);
`);

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}
