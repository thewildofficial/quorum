# Quorum - Reinforce Events

**Luma-style event management for Reinforce, the AI/ML club at Scaler School of Technology.**
Members discover talks, workshops and build nights; organizers publish events with capacity
limits; RSVPs overflow onto an automatic waitlist.

- Problem: club events get planned in chat threads. Nobody knows how many people are actually
  coming, capped workshops overbook, and cancellations free seats nobody hears about.
- Target users: Reinforce members (SST students) and club organizers.
- Solution: a small event platform - public event pages, Google sign-in restricted to SST
  accounts, RSVP with capacity + automatic waitlist promotion, and an organizer console.

## Key features

1. **Event discovery** - public, Luma-style listing with search and upcoming/past filters. No
   account needed to browse.
2. **Google sign-in restricted to SST** - OAuth authorization-code flow; the ID token is verified
   server-side and the `hd` (hosted domain) claim must equal `sst.scaler.com`. The check runs in
   the login callback so it cannot be bypassed by client tricks; tokens without `hd` are rejected
   even when the email looks right.
3. **RSVP with capacity** - one transaction checks remaining seats and writes the RSVP, so two
   people cannot take the last seat at once. Full events hand out waitlist positions instead.
4. **Automatic waitlist promotion** - when a "going" RSVP is cancelled or the organizer raises
   capacity, the waitlist head is promoted in the same transaction, in position order.
5. **Organizer console** - publish events with validation (end after start, no past starts),
   edit capacity (never below the current going count), see the full attendee/waitlist list,
   cancel an event (cancels all RSVPs).

## Tech stack

React 18 + Vite client; Node 22 + Express API; Postgres (`pg`) with transactional seat counting;
session-cookie auth after Google OAuth (no third-party auth SDK); hand-built CSS. No external
services besides Google sign-in; no API keys to leak beyond the OAuth client configuration.

## Architecture

```
server/src/domain/waitlist.js    Pure capacity/waitlist rules (unit-tested)
server/src/google.js             OAuth exchange + token verification + domain policy
server/src/services/             Event service: transactions, promotion, authorization
server/src/routes/               REST endpoints with validation
client/src/pages/                Discovery, event detail, My RSVPs, create event, login
```

Engineering decisions worth a look:

- **Race-safe RSVP**: seat counting (`SELECT ... FOR UPDATE` row lock) and insertion happen inside one Postgres transaction, so a
  last seat cannot be sold twice.
- **Promotion in the same transaction** as the cancellation/capacity edit that triggers it -
  the waitlist can never be skipped by a concurrent RSVP.
- **Domain rules are pure** (`domain/waitlist.js`) and tested separately from the API.
- **Authorization everywhere**: attendees list and edits are organizer-only; the organizer
  cannot RSVP to their own event; RSVPs are per-user idempotent (unique constraint + 409).

## Local setup

Requires Node.js 20+.

```bash
npm run install:all
npm run build
npm run seed    # optional: synthetic demo organizer, members and events
npm start       # http://localhost:4000
npm test        # 15 unit + integration tests
```

Browsing works without login. To try RSVP/sign-in locally, configure Google OAuth (below);
without it, the app still runs and the login page explains the requirement.

## Google OAuth configuration (required for sign-in)

Sign-in uses Google OAuth restricted to the SST workspace domain:

1. In Google Cloud Console create a project, configure the OAuth consent screen, and create an
   "OAuth 2.0 Client ID" of type **Web application**.
2. Add authorized redirect URI: `http://localhost:4000/api/auth/google/callback` (and the
   deployed equivalent later).
3. Copy `.env.example` values into your environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `ALLOWED_GOOGLE_DOMAIN` (default `sst.scaler.com`), and `ORGANIZER_EMAILS` (comma-separated
   list of SST emails who may publish events; everyone else is a member).
   To use the seeded organizer console locally, include
   `ORGANIZER_EMAILS=organizer@seed.quorum.local`. Organizer authority is this
   allowlist, checked on every request - removing an email revokes access
   immediately, even for sessions issued earlier.

See `.env.example`. Secrets stay in the environment; nothing is committed.

## Deployment

Single Node process backed by Postgres (`DATABASE_URL`) - see `DEPLOYMENT.md` for the free
persistent route (Render free web + Neon free Postgres) and its caveats, plus `render.yaml`/`Dockerfile`
for one-command routes. Deployment is a
deliberate choice the project owner makes; nothing here deploys itself.

## Design

The visual language is pulled from the club's dashboard (Reinforce-Student-Dashboard,
`web/app/globals.css`): the gold brand colour sampled from the club logo (#E5B731) on
near-black surfaces, Instrument Serif display type and Plus Jakarta Sans body. Only the
styling is shared; all event/RSVP logic here is new.

## Relationship to the Reinforce platform

Quorum is a standalone app designed to complement the club's existing platform
(Reinforce-SST/Reinforce-Student-Dashboard, built by the club team). It shares no code with that
repo and does not modify it; its event/RSVP model is designed so it could later be integrated or
linked from the dashboard.

## Project status and AI usage

Built as an end-term project. AI assistance was used for code generation and review, as permitted
by the course guidelines; every workflow was verified end to end (see `npm test` and `docs/`).
All seeded people and events are synthetic.
