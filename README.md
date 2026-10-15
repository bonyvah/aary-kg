# aary kg

A Kahoot-inspired live quiz platform with stricter anti-cheat, plus a jury-based contest mode. Built for a small community: a handful of admins, a limited number of users, and players who just join with a PIN.

> Status: all six build phases are done. What is left is yours to decide (hosting, branding, the final Kyrgyz wording) and a first real run of the container images, see `docs/deploy.md`.

## What it does

The interface is available in Kyrgyz and Russian.

### Live quiz games
- A user creates a quiz and hosts a live game.
- Players join with a game PIN and a nickname. No account needed.
- Questions are pushed in real time, answers are scored by speed and correctness, and the game ends with a leaderboard and podium.
- Individual play only. No teams.

### Contests
- A user creates a contest and invites juries (other users).
- Each jury member gives points to entries.
- The final result is the aggregate of all jury scores.

### Roles

| Role   | How they get in               | What they can do                                                  |
|--------|-------------------------------|-------------------------------------------------------------------|
| Admin  | Seeded / created by an admin  | Create and manage users, manage contests, full visibility         |
| User   | Created by an admin           | Create quizzes, host games, create contests, act as jury          |
| Player | No auth, joins with a PIN     | Join and play live games                                          |

There is no public registration. Accounts are created by admins.

Players and staff use separate areas of the same app: the player side (`/`) is just PIN entry and play, while staff (`/login`, dashboard, host, admin) is behind authentication.

## Anti-cheat

The server is authoritative. The client is never trusted.

- Server-side timer and answer timing
- Correct answers never sent before reveal
- One connection per player, duplicate join detection, token-based rejoin
- Strict server-side validation of every answer
- Rate limiting
- Client-side behavior signals (tab switches, focus loss, paste) are logged and shown to the host as flags, not treated as proof
- Suspicious pattern flags and a per-game audit trail

## Tech stack

| Layer          | Choice                                              |
|----------------|-----------------------------------------------------|
| Frontend       | Next.js (App Router), TypeScript, Tailwind CSS      |
| Backend        | FastAPI (Python 3.12+), async, WebSockets           |
| Database       | PostgreSQL, SQLAlchemy 2.0 (async), Alembic         |
| Live state     | Redis (game state, PIN TTL, pub/sub, rate limits)  |
| i18n           | next-intl, Kyrgyz and Russian only                  |
| Auth           | JWT for admin/user, game-scoped token for players   |
| Font / icons   | Montserrat (latin + cyrillic), Phosphor + custom SVG |

## Design

Kahoot-inspired in feel (bold colors, chunky buttons, shape-coded answer tiles), with its own branding and assets. Players appear as one of eight shape characters (no photos). The design system lives in `design-system/` (tokens, component styles, avatars) and the screen designs in `design-refs/`. See `CLAUDE.md` for the rules.

## Run locally

Needs Docker (with compose), [uv](https://docs.astral.sh/uv/), pnpm and Node 22.

```bash
make up                                          # Postgres + Redis, migrations, backend, web app
make admin LOGIN=aizhan NAME="Your Name"         # first time: prints a password once
```

Then open http://localhost:3000. `make help` lists the rest: `make logs`, `make status`, `make down`,
`make test`, `make check`, `make e2e`. Without Docker, start your own Postgres and Redis (the URLs
are in `backend/.env`, created for you from `backend/.env.example`) and use `make up SKIP_DOCKER=1`.

By hand, if you prefer separate terminals:

```bash
docker compose up -d --wait                       # Postgres + Redis

cd backend
cp .env.example .env                              # development settings
uv sync
uv run alembic upgrade head
uv run python -m app.cli create-admin --login aizhan --name "Your Name"   # prints a password once
uv run uvicorn app.main:app --reload --port 8000 --no-proxy-headers       # always with --no-proxy-headers

cd ../frontend
pnpm install
pnpm dev                                          # http://localhost:3000, /api is proxied to :8000
```

Set `API_URL` for the frontend if the backend is not on `http://localhost:8000`.

## Checks

```bash
# one time: the tests use their own database (and Redis db 15) and empty them, never your dev data
docker compose exec postgres createdb -U postgres aary_test

cd backend
uv run ruff check . && uv run ruff format --check . && uv run pytest

cd ../frontend
pnpm lint && pnpm exec tsc --noEmit && pnpm check && pnpm build && pnpm check:bundle

# with a whole stack running (see frontend/e2e/README.md): real browsers, host and phone-sized players
E2E_LOGIN=<admin login> E2E_PASSWORD=<password> pnpm e2e
# and a game with up to 200 players (see docs/load-test.md)
```

GitHub Actions runs the first two groups on every push to `main`.

## Documents

| | |
|---|---|
| `CLAUDE.md` | the rules of the project |
| `docs/protocol.md` | how a live game talks (WebSocket messages, scoring, anti-cheat, rate limits) |
| `docs/contest-scoring.md` | how a contest is scored and ranked |
| `docs/deploy.md` | running it in containers, what a proxy in front must do, backups |
| `docs/load-test.md` | the load test and its results |

## Roadmap

1. Design foundation and component kitchen sink (`/design`): done
2. Player flow screens: done
3. Host and user screens: done
4. Admin and contest screens: done
5. Backend: DB, auth, REST, WebSocket game engine, anti-cheat: done
6. Hardening, tests, containers, CI: done

## Project structure

```
aary-kg/
  frontend/   # Next.js app
  backend/    # FastAPI app
  docs/       # decisions and protocol spec
  design-system/  # tokens, component styles, avatars
  design-refs/    # screen designs
```

## Getting started

Not available yet. Setup instructions will be added once the frontend and backend are scaffolded.

## Workflow

- Work happens on feature branches, never directly on `main`.
- Commits are atomic: one logical change each, building and passing tests at every commit.
- Every finished task goes through a small pull request that says what changed, why, and how to check it, with a screenshot for UI changes.

## License

TBD