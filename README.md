# aary kg

A Kahoot-inspired live quiz platform with stricter anti-cheat, plus a jury-based contest mode. Built for a small community: a handful of admins, a limited number of users, and players who just join with a PIN.

> Status: Phase 5 in progress. All screens exist; the backend is being built slice by slice and the screens are wired to it as each piece lands (auth and admin users are live).

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

```bash
docker compose up -d                      # Postgres + Redis

cd backend
cp .env.example .env                      # set AARY_JWT_SECRET (32+ chars)
uv sync
uv run alembic upgrade head
uv run python -m app.cli create-admin --login aizhan --name "Your Name"   # prints a password once
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                             # needs Postgres (database aary_test) running

cd ../frontend
pnpm install
pnpm dev                                  # http://localhost:3000, /api is proxied to :8000
```

Set `API_URL` for the frontend if the backend is not on `http://localhost:8000`.

## Roadmap

1. Design foundation and component kitchen sink (`/design`)
2. Player flow screens (mock data)
3. Host and user screens (mock data)
4. Admin and contest screens (mock data)
5. Backend: DB, auth, REST, WebSocket game engine, anti-cheat
6. Hardening and deployment

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