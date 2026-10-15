# Load test

`backend/scripts/loadtest.py` plays a whole game with many players over real WebSockets against a
running server, and checks the results as well as timing them.

## Run it

Start Postgres, Redis and the backend. One machine pretending to be many phones would hit the
per-address rate limits (30 joins a minute), so start the backend with **one trusted proxy**: the
script then sends a different `X-Forwarded-For` for every player, as 60 phones behind a proxy
would.

```bash
cd backend
AARY_TRUSTED_PROXY_HOPS=1 uv run uvicorn app.main:app --port 8000 --no-proxy-headers   # one terminal
uv run python scripts/loadtest.py --login <staff login> --password '<password>' \
    --players 60 --questions 5                                          # in another
```

Use `--base http://localhost:3000 --prefix /api` to go through the web app's proxy instead, and
`--no-spoof` to test the rate limits themselves.

## What it checks
- everybody gets in; the host's lobby lists everybody
- every question reaches every player, every answer is acknowledged, no player gets an error
- the question closes once everybody has answered (no waiting for the timer)
- every final score is possible for what that player answered (500 to 1000 per right answer, the
  sum of the per-question points), ranks are exactly 1..N and follow the scores
- the saved report has every player

## Result (one development machine)
Backend, Redis, Postgres **and all the simulated players on the same machine**, one backend
process: a worst case for timing, not a benchmark of a real deployment. 5 questions, players
answer 0.2 to 3 s after the question appears, 60% of answers right.

| players | join (all at the same instant), p50 / p95 | answer acknowledged, p50 / p95 | host command to question on the phone, p50 / p95 | last answer to question closed |
|---|---|---|---|---|
| 60 | 321 / 350 ms | 6 / 14 ms | 7 / 10 ms | 47 ms |
| 200 (the game's limit) | 1432 / 2214 ms | 8 / 23 ms | 20 / 38 ms | 167 ms |

Joining is the slow part only because everybody joins in the same instant (each join is a few
milliseconds of server work, done one after another); a real room fills over a minute. During the
game itself, the numbers are tens of milliseconds at 200 players.

## What it found
At 200 simultaneous joins the first run answered some with HTTP 500: redis-py's default connection
pool holds 100 connections and fails at once when they are all busy. The backend now uses a pool
that waits for a free connection (`AARY_REDIS_MAX_CONNECTIONS`, default 100), covered by a test.
