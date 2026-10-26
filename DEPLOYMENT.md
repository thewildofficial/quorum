# Deployment notes

The app is a single Node process with an embedded SQLite file. Pick based on what the deployment
is for. Facts below verified against vendor docs on 2026-10-26; links included.

## Option A - Render free tier (demo/evaluation deployment, no card needed)

Render's free web services have an **ephemeral filesystem**: anything written locally is lost on
every restart, redeploy, or free-tier spin-down
(https://render.com/docs/faq, "Why do files saved to my service's filesystem disappear?";
persistent disks are paid-plan only, https://render.com/docs/disks).

That would normally rule SQLite out. This repo ships `render.yaml` with `SEED_ON_EMPTY=1`: whenever
the app boots with an empty database it re-seeds the synthetic demo account and sample decisions.
Effect: evaluators always land on a working app with demo content, can click around, and even create
their own account and decisions - which survive until the next restart, then reset. For a grading
demo this is fine. For real use, it is not.

Steps: push the repo to GitHub, in Render choose New > Blueprint and point it at the repo, deploy.
Afterwards open the URL in an incognito window to confirm it loads (the app's own login page is
expected). Demo login: demo@quorum.local / demo-password-123 (change `SEED_EMAIL`/`SEED_PASSWORD`
in render.yaml if you want different demo credentials).

## Option B - Oracle Cloud Always Free VM (real persistence, $0, card needed for identity check)

Oracle's Always Free tier includes ARM VMs that stay free
(https://www.oracle.com/cloud/free/, https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm).
Signup asks for a credit/debit card for identity verification. On the VM:

```bash
docker build -t quorum .
docker run -d --restart unless-stopped -p 80:4000 -v quorum-data:/app/data quorum
```

The named volume keeps the SQLite database across restarts and redeploys. Do NOT set SEED_ON_EMPTY
here unless you want demo data.

## Not recommended

- **Fly.io**: no free tier for new organizations (trial is 2 hours of runtime or 7 days,
  https://docs.fly.io/about/pricing).
- **Render free without SEED_ON_EMPTY**: database silently wiped on every spin-down.
- **Netlify/Vercel-style serverless**: no persistent local filesystem for SQLite.

Whatever you choose, verify in an incognito window afterwards that the URL loads without any
platform login wall.


## Recommended persistent path (researched 2026-10-26)

Render's free web tier keeps an ephemeral filesystem (SQLite resets on every
redeploy/restart - render.com/docs, "Free instance limitations"), so the
SQLite-in-container route is demo-only. For a real deployment that costs $0:

- **Option A: Render free web service + Neon free Postgres** - no card needed.
  Neon free is $0/month with 1 GB storage per project and 100 CU-hours
  (neon.com pricing). Requires migrating the data layer from SQLite to
  Postgres. Render free web sleeps after inactivity (cold start on first hit).
- **Option B: Oracle Cloud Always Free VM** (Ampere ARM, up to 4 cores/24 GB) -
  keeps the current SQLite code unchanged on a persistent disk; signup requires
  a credit/debit card for identity (oracle.com/cloud/free). No charges under
  Always Free resources.

Both keep the app's own code identical apart from Option A's database layer.
Neither is deployed yet - deployment happens only on the project owner's call.
