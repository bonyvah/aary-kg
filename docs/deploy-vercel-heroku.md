# Deploying: web app on Vercel, backend on Heroku, Postgres on Neon, Redis on Upstash

No custom domain needed. The pieces and how they talk:

- The browser loads pages from **Vercel** (`https://<app>.vercel.app`). Every `/api/...` request
  goes there too, and Vercel forwards it to Heroku. So signing in, quizzes, reports are one site
  for the browser and the session cookie just works.
- **Game sockets can't go through Vercel** (it does not forward WebSockets). The browser opens them
  straight to Heroku (`wss://<backend>.herokuapp.com`). Players prove who they are with their game
  token, the host with a one-minute ticket the page fetches through `/api` first.
- Rate limits need the visitor's address. Requests through Vercel carry it in a header signed with
  a shared secret (`AARY_PROXY_SECRET`); sockets get it from Heroku's router (`AARY_TRUSTED_PROXY_HOPS=1`).

## 1. Neon (Postgres)
Create a project and copy the **direct** connection string (the host without `-pooler`). Paste it as
Neon gives it: `postgresql://…?sslmode=require&channel_binding=require` is converted for the
backend's driver. The database sleeps when idle; the first request after that waits a moment.

## 2. Upstash (Redis)
Create a database and copy the `rediss://default:<password>@<host>:6379` URL (TLS). It holds only
running games. Check the command limits of your plan against a real game before an event.

## 3. Heroku (backend)
```bash
heroku create <backend>
heroku stack:set container -a <backend>        # builds backend/Dockerfile (heroku.yml)
heroku config:set -a <backend> \
  AARY_ENV=production AARY_COOKIE_SECURE=true AARY_TRUSTED_PROXY_HOPS=1 \
  AARY_DATABASE_URL='<neon direct url>' AARY_REDIS_URL='<upstash rediss url>' \
  AARY_JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" \
  AARY_PROXY_SECRET='<secret, same as on Vercel>' \
  AARY_ALLOWED_ORIGINS='https://<app>.vercel.app'
git push heroku main
heroku run -a <backend> python -m app.cli create-admin --login <login> --first-name "<First>" --last-name "<Last>"
```
Make the proxy secret once: `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`.
Migrations run each time the dyno starts. Use a dyno that does not sleep (Basic or higher) for
game days: an Eco dyno sleeps after 30 minutes without traffic. Dynos restart about once a day,
which ends a game that is running then.

## 4. Vercel (web app)
Import the repository, **Root Directory** `frontend`, framework Next.js. Environment variables
(they are read at build time, so redeploy after changing them):

| variable | value |
|---|---|
| `API_URL` | `https://<backend>.herokuapp.com` (where `/api` is forwarded) |
| `NEXT_PUBLIC_WS_URL` | `wss://<backend>.herokuapp.com` (game sockets) |
| `AARY_PROXY_SECRET` | the same secret as on Heroku |

## Checks after the first deploy
- `https://<backend>.herokuapp.com/health/ready` says Postgres and Redis are `true`.
- Sign in at `https://<app>.vercel.app/login`, host a game, join it from a phone.
- Host screen closes right away: `AARY_ALLOWED_ORIGINS` is not exactly the Vercel address.
- Everyone gets "too many tries": the proxy secret differs between Vercel and Heroku.
