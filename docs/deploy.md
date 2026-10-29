# Running aary kg in containers

This is how to run the whole app with Docker. It does not pick a host, a domain or an HTTPS
proxy: those are yours to choose. What it gives you is four containers (Postgres, Redis, the
backend, the web app) started by one command, and a list of what the proxy in front must do.

> **Not tried in a container build.** The Dockerfiles and `docker-compose.prod.yml` were written
> and checked step by step on a machine without Docker (the same commands run natively: the
> production-only dependencies, the migrations, the start command with production settings, the
> web app's standalone server). The first `docker compose build` on a machine with Docker is the
> first real build: if it fails, the error will be small and local, please tell me.

## What runs

| container | what | published |
|---|---|---|
| `postgres` | Postgres 16, volume `pgdata` | no |
| `redis` | Redis 7, nothing saved to disk (live game state only) | no |
| `backend` | FastAPI + uvicorn, runs the migrations when it starts | no |
| `frontend` | the Next.js web app; forwards `/api` (HTTP and WebSockets) to the backend | `127.0.0.1:3000` |

Only the web app is reachable from outside the compose network, and by default only from the
machine itself: your HTTPS proxy goes there.

## First start

```bash
cp .env.prod.example .env.prod          # then fill it in (see the table below)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend \
    python -m app.cli create-admin --login <login> --first-name "<First>" --last-name "<Last>"    # prints a password once
```

Open the site (through your proxy) and sign in at `/login`. The admin creates everybody else.

Generate the two secrets:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # POSTGRES_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # AARY_JWT_SECRET
```

The backend **refuses to start** in production with an insecure setup (see `AARY_ENV`), and says
which setting is wrong in its log: `docker compose ... logs backend`.

## Settings (`.env.prod`)

| variable | meaning |
|---|---|
| `POSTGRES_PASSWORD` | password of the database user `aary` |
| `AARY_JWT_SECRET` | signs session cookies and player tokens. Long and random. Changing it signs everybody out |
| `AARY_PUBLIC_ORIGIN` | the site exactly as people type it, e.g. `https://quiz.example`. Becomes `AARY_ALLOWED_ORIGINS`: the only sites whose pages may open the game WebSockets |
| `AARY_TRUSTED_PROXY_HOPS` | how many reverse proxies stand in front of the web app. `1` = your HTTPS proxy. `0` = nothing: then the backend can't tell visitors apart (see below) |
| `FRONTEND_BIND`, `FRONTEND_PORT` | where the web app is published on the machine. Default `127.0.0.1:3000` |

Set inside the compose file, from the above: `AARY_ENV=production`, `AARY_COOKIE_SECURE=true`,
`AARY_DATABASE_URL`, `AARY_REDIS_URL`. Other backend settings (`AARY_JWT_TTL_MINUTES`,
`AARY_REDIS_MAX_CONNECTIONS`) are in `backend/.env.example`.

## Images (Cloudflare R2)

Quiz covers and question images are kept in an R2 bucket. The backend writes them (as WebP,
named by their hash, never changed); browsers read them straight from the bucket's public URL.

1. Create a bucket, e.g. `aary-images`, and turn on public access (a custom domain, or the
   `r2.dev` URL).
2. Create an API token with *Object Read & Write* on that bucket.
3. Backend: `AARY_R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com`,
   `AARY_R2_ACCESS_KEY_ID`, `AARY_R2_SECRET_ACCESS_KEY`, `AARY_R2_BUCKET`.
4. Web app, when it is built: `NEXT_PUBLIC_IMAGES_URL=<the public URL of the bucket>` (no trailing
   slash). It also lets the pages load images from there (content security policy).

Without `AARY_R2_ENDPOINT` uploads answer `IMAGES_NOT_CONFIGURED`; quizzes still work without
images. In development docker compose runs MinIO in place of R2 (console on `localhost:9001`).

## What the proxy in front must do

1. **Terminate HTTPS** and forward to the web app (`127.0.0.1:3000`). The session cookie is marked
   secure: over plain http nobody can sign in.
2. **Pass WebSocket upgrades** for `/api/ws/` (`Upgrade` and `Connection` headers). Without it the
   live game does nothing: players join, but the game never starts for them.
3. **Put the visitor's address in `X-Forwarded-For`** (set or append). The web app passes the
   header through unchanged, and the backend reads the last entry when `AARY_TRUSTED_PROXY_HOPS=1`.
   This matters: the rate limits are per address. Without it every visitor looks like the web
   app's own address, so one person guessing PINs would block everyone.
4. Keep the `Host` header, and send the real site address in `Origin` (browsers do that on their own).

The backend also checks the `Origin` of WebSocket connections against `AARY_PUBLIC_ORIGIN`. If the
host screen closes straight after opening, that setting does not match the address in the browser
(`https://` vs `http://`, a missing `www.`, a port).

### Classrooms and rate limits
A whole class on school Wi-Fi shares one public address, so joining is limited by what an
attacker does (guessing PINs: many *failed* lookups, 20 a minute per address), not by how many
people join (300 joins a minute per address). Staff login: 20 attempts per 10 minutes per address
and 8 failed attempts per login. Details in `docs/protocol.md`.

## Upgrading

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

The backend runs `alembic upgrade head` each time it starts. Migrations only go forward, so **take
a backup first** (below). A game in progress ends when the backend restarts: players see "connection
lost" and join again. Do upgrades between games.

If you ever run several backend containers, start one first so two don't migrate at the same time.
Several instances do work together (game events travel through Redis).

## Backups

Everything worth keeping is in Postgres. Redis only holds games that are running right now.

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U aary aary | gzip > aary-$(date +%F).sql.gz

# restore into an empty database:
gunzip -c aary-2026-01-01.sql.gz | docker compose --env-file .env.prod -f docker-compose.prod.yml \
    exec -T postgres psql -U aary aary
```

## Good to know
- A game that is never finished (the host closes the tab and leaves) is not saved: it disappears
  from Redis after 12 hours.
- If Redis restarts, running games are lost (the history in Postgres is not).
- The containers run as non-root users. The web app's security headers (a content security
  policy, no framing, ...) come from the app itself.
- `docs/load-test.md` has a script that plays a whole game with up to 200 players: run it against
  the real setup before a big event (`AARY_TRUSTED_PROXY_HOPS=1`, and start the backend with
  `--no-proxy-headers`, as the Dockerfile does).

## Troubleshooting
| what you see | probably |
|---|---|
| backend restarts in a loop | read `logs backend`: an unsafe production setting, or Postgres not reachable |
| the site loads but signing in does nothing | the proxy isn't serving https (secure cookie), or `/api` doesn't reach the web app |
| host screen closes right after opening | `AARY_PUBLIC_ORIGIN` doesn't match the site's address |
| players join but never get the question | the proxy doesn't pass WebSocket upgrades on `/api/ws/` |
| everybody gets "too many tries" | the proxy doesn't set `X-Forwarded-For`, or `AARY_TRUSTED_PROXY_HOPS` doesn't match the proxies in front |
| `/api/health/ready` says 503 | `postgres` or `redis` in its answer is `false`: that container is down |
