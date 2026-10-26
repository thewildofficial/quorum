# Deployment

Quorum is a single Node process (Express API + built React client) backed by
Postgres. The server reads its connection string from `DATABASE_URL`, so it
runs anywhere a Node process and a Postgres database are available.

## Recommended free persistent route: Render web service + Neon Postgres

This is the route this project uses. Both tiers are free as of October 2026:

- **Render free web services** (`plan: free`, already configured in
  `render.yaml`): no cost, but the service **spins down after 15 minutes of
  inactivity** and the next request waits through a cold start. Source:
  https://render.com/docs/free
- **Neon free Postgres**: $0/month, 1 GB storage per project, compute scales
  to zero after 5 minutes idle (first query after idle adds a short wake-up).
  Source: https://neon.com/pricing

Do **not** use Render's own free Postgres for this project: Render deletes free
Postgres instances 30 days after creation (14-day grace), so it is not
persistent. Source: https://render.com/docs/free

### Steps

1. Create a Neon project and copy its `postgres://...` connection string.
2. Create a Render web service from this repo (the `render.yaml` blueprint is
   detected automatically) and keep `plan: free`.
3. In the Render dashboard, set environment variables (never commit these):
   - `DATABASE_URL` - the Neon connection string
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - from the Google Cloud
     OAuth client (see README, "Google OAuth setup")
   - `GOOGLE_REDIRECT_URI` - `https://<your-service>.onrender.com/api/auth/google/callback`
   - `SEED_ON_EMPTY=1` - seeds synthetic demo members and events only when the
     events table is empty, so evaluators always see a working app
   - `ORGANIZER_EMAILS` - comma-separated emails allowed to create events
4. Add the same callback URL to the OAuth client's authorized redirect URIs in
   Google Cloud Console.

Seed users are synthetic and cannot log in (login requires a real Google
account on the SST domain); browsing works publicly without login.

## Alternative: Docker

The `Dockerfile` builds a single image (client bundle + API server). Run it
with `DATABASE_URL` pointed at any reachable Postgres:

```sh
docker build -t quorum .
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/quorum \
  -e GOOGLE_CLIENT_ID=... -e GOOGLE_CLIENT_SECRET=... \
  -e GOOGLE_REDIRECT_URI=https://your-host/api/auth/google/callback \
  -e SEED_ON_EMPTY=1 \
  quorum
```

## Not suitable

- **Serverless platforms (Netlify/Vercel-style functions)**: the app is a
  long-lived Express server with session cookies; it is not packaged as
  serverless functions.

## Cost honesty

The Render + Neon route is free under the terms linked above as of October
2026. Free tiers change; re-check the linked pages before presenting limits.
Neither tier requires a credit card for signup as of this writing.
