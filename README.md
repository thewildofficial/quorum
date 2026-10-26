# Deliberate

**A decision journal that holds your reasoning accountable.** Deliberate helps you compare real
options against weighted criteria, shows you how fragile the resulting ranking is, records a
falsifiable forecast when you commit, and later scores how calibrated your confidence actually was.

- Problem: people make consequential choices by vibes, then rewrite history afterwards. The
  reasoning that produced a decision is usually gone by the time the outcome arrives.
- Target users: students, researchers, and anyone making repeated judgment calls (projects to
  prioritise, roles to take, tools to buy) who wants feedback on the *quality of their judgment*,
  not just on outcomes.
- Solution: a small web app that forces the full loop - frame, weigh, score, stress-test, commit
  with a prediction, review against an explicit success criterion.

## Key features

1. **Decision builder** - create a decision with 2-10 options and 2-10 weighted criteria, then
   score every option 0-10 against every criterion in a matrix editor.
2. **Weighted ranking** - weights are normalised, every option gets a transparent weighted score,
   and the margin between the leader and the runner-up is shown explicitly.
3. **Sensitivity analysis** - each criterion's weight is varied between 0.5x and 2x (one at a time)
   to show how the leader's margin moves, whether the winner flips, and if so at exactly which
   weight multiplier (found by bisection on the continuous margin function). Verdicts are honestly
   scoped: "robust in tested range" never claims global optimality.
4. **Forecast commit** - deciding requires a probability, an observable success criterion, and a
   review date. Options, criteria, and scores freeze at that moment so the forecast stays honest.
5. **Outcome review & calibration** - record what actually happened; the app computes a Brier score
   per decision and a binned calibration curve across all reviewed decisions, so you can see whether
   your 70% calls really happen 70% of the time.

Supporting functionality: email/password accounts with per-user data isolation, search and status
filtering over decisions, loading/empty/error states on every screen, and seeded synthetic demo data.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite, React Router | Component model fits the matrix editor and live analysis; fast dev loop |
| Charts | Hand-rolled SVG/CSS | Tornado and calibration plots are small, bespoke, and dependency-free |
| Backend | Node 22 + Express 4 | Simple REST API, single process serves API and built client |
| Database | SQLite via better-sqlite3 | Zero-config persistence; runs identically for every evaluator; transactional writes |
| Auth | Session cookies (httpOnly) + bcryptjs | No third-party dependency; passwords never stored in plain text |
| Tests | node:test (built-in) | Unit tests for domain logic + full API integration tests |

## Architecture

```
client/                 React SPA (Vite build, served statically in production)
  src/pages/            Login, Dashboard, NewDecision wizard, DecisionDetail, Analytics
  src/components/       RankingBars, TornadoChart, CalibrationChart, shared UI
server/
  src/domain/           Pure, unit-tested logic: scoring, sensitivity, calibration
  src/services/         Decision service: ownership checks, state machine, persistence
  src/routes/           REST endpoints with input validation
  src/middleware/       Session auth, validators, central error handler
  data/                 SQLite file (git-ignored, created on first run)
```

Key engineering decisions:

- **Domain logic is pure and separate** (`server/src/domain/`). The scoring, sensitivity, and
  calibration modules have no I/O and are unit-tested directly; routes are a thin shell.
- **Guarded state machine**: `draft -> decided -> closed`. Editing after deciding is rejected
  (409), deciding without a complete matrix is rejected (422), outcomes can only follow a decision.
  This is what makes the calibration data trustworthy.
- **Authorisation on every object**: all decision queries are scoped to the authenticated user;
  cross-user access returns 403.
- **Transactions** for multi-write operations (decide, outcome, score batches) so partial writes
  cannot corrupt the workflow state.

### The sensitivity math

With normalised weights `w_i` and scores `s_i`, an option's total is `S = Σ w_i · s_i`. Scaling one
criterion's weight by a multiplier `m` and renormalising makes the leader's margin a continuous
function of `m`. A sign change between `m = 1` and the range edge brackets the flip point, which
bisection then locates to ~0.001 precision. The verdict "robust" means no flip occurred for any
single weight inside `m ∈ [0.5, 2]` - a local statement, advertised as such in the UI.

## Local setup

Requires Node.js 20+.

```bash
npm run install:all   # installs root, server, and client dependencies
npm run build         # builds the React client into client/dist
npm run seed          # optional: synthetic demo account (demo@deliberate.local / demo-password-123)
npm start             # serves the app on http://localhost:4000
```

Development mode (API on :4000, Vite dev server with proxy on :5173):

```bash
npm run dev
```

Run the tests:

```bash
npm test              # 16 unit + integration tests (node:test, no external services)
```

## Environment variables

See `.env.example`. Everything has a safe local default; there are no third-party API keys to
leak by design.

## Docker

```bash
docker build -t deliberate .
docker run -p 4000:4000 -e SEED=1 -v deliberate-data:/app/data deliberate
```

The named volume keeps the SQLite database across container restarts.

## Deployment

Any Node host that supports persistent disk works (the SQLite file must survive restarts). The
repository ships a production Dockerfile; on platforms with ephemeral filesystems, attach a
persistent volume mounted at `/app/data`. See `DEPLOYMENT.md` for a concrete free-tier walkthrough.

## Demo video

See `DEMO.md` for the 3-5 minute script that walks the rubric-relevant workflows.

## Project status and AI usage

Built as an end-term project. AI assistance was used during development for code generation and
review, as permitted by the course guidelines; all workflows were tested and verified end to end
(see `npm test` and the screenshots in `docs/`).

## Data

All seeded content is synthetic sample data about fictional decisions. No real personal data.
