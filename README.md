# aary kg

A Kahoot-inspired live quiz platform with stricter anti-cheat, plus timed exams for student groups and a jury-based contest mode. Built for a small community: a handful of admins, a limited number of teachers and students, and players who just join with a PIN.

> Status: all six build phases are done. What is left is yours to decide (hosting, branding, the final Kyrgyz wording) and a first real run of the container images, see `docs/deploy.md`.

## What it does

The interface is available in Kyrgyz and Russian.

### Quizzes
- A teacher builds a quiz in a two-step editor: title and cover, then questions (reorderable, each with an optional image). Unsaved work is kept as drafts.
- Questions can also come from teaching material (several files, generated with OpenAI), from another quiz, or from a JSON file or pasted JSON. A quiz downloads as JSON too.
- Images are cut to 16:9 when uploaded: the teacher drags a window over the picture to choose the part that stays.
- The quiz bazar: every teacher can browse, host and copy other teachers' quizzes, and share any quiz by link.

### Live quiz games
- A teacher hosts a live game from any quiz.
- Players join with a game PIN and a nickname. No account needed.
- Questions are pushed in real time, answers are scored by speed and correctness, and the game ends with a leaderboard and podium.
- Individual play only. No teams.
- Results download as Excel or PDF.

### Exams
- A teacher writes an exam sheet (by hand, from a quiz or from teaching material) and starts it for student groups, with attendance.
- Students sign in and take it against the server's clock, in full screen. After the close they see their score and the correct answers.
- The teacher sees the results and the anti-cheat signals, rules on them, and can grant a second attempt (logged). Admins see every exam read-only.

### Contests
- A teacher creates a contest and invites juries (other teachers).
- Each jury member gives points to entries.
- The final result is the aggregate of all jury scores.

### Roles

| Role   | How they get in               | What they can do                                                  |
|--------|-------------------------------|-------------------------------------------------------------------|
| Admin  | Seeded with the CLI           | Create and disable teachers and students (never admins, who aren't listed), manage student groups, set or generate passwords, see all contests, games and exams and correct a finished game's data. Does not create quizzes or contests or host games |
| Teacher| Created by an admin           | Create quizzes and exam sheets, host games, run exams, create contests, act as jury |
| Student| Created by an admin, in a group | Take exams at `/student`                                       |
| Player | No auth, joins with a PIN     | Join and play live games                                          |

There is no public registration. Accounts are created by admins.

Players and staff use separate areas of the same app: the player side (`/`) is just PIN entry and play, while staff (`/login`, dashboard, host, admin) and students (`/student`) are behind authentication.

## Anti-cheat

The server is authoritative. The client is never trusted.

- Server-side timer and answer timing
- Correct answers never sent before reveal
- One connection per player, duplicate join detection, token-based rejoin
- Strict server-side validation of every answer
- Rate limiting
- Full screen is expected; leaving the tab, another window taking focus and leaving full screen are logged and shown to the host (or the exam's teacher) as signals, never proof. The host decides what happens
- Answer speed is never flagged
- A per-game audit trail

## Tech stack

| Layer          | Choice                                              |
|----------------|-----------------------------------------------------|
| Frontend       | Next.js (App Router), TypeScript, Tailwind CSS      |
| Backend        | FastAPI (Python 3.12+), async, WebSockets           |
| Database       | PostgreSQL, SQLAlchemy 2.0 (async), Alembic         |
| Live state     | Redis (game state, PIN TTL, pub/sub, rate limits)  |
| Images         | Cloudflare R2 (MinIO in local dev), stored as WebP  |
| Questions from material | OpenAI                                     |
| i18n           | next-intl, Kyrgyz and Russian only                  |
| Auth           | JWT for admin/teacher, game-scoped token for players|
| Font / icons   | Montserrat (latin + cyrillic + cyrillic-ext), Phosphor + custom SVG |

## Design

Kahoot-inspired in feel (bold colors, chunky buttons, shape-coded answer tiles), with its own branding and assets. Players appear as one of eight shape characters (no photos). The design system lives in `design-system/` (tokens, component styles, avatars) and the screen designs in `design-refs/`. See `CLAUDE.md` for the rules.

## Run locally

Needs Docker (with compose), [uv](https://docs.astral.sh/uv/), pnpm and Node 22.

```bash
make up                                          # Postgres, Redis, MinIO, migrations, backend, web app
make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova # first time: prints a password once
```

The admin only manages: sign in at `/login`, create a teacher (Admin area, Teachers tab), then sign in as that teacher to build quizzes and host games. Students go in a group (Groups tab first, then the Students tab).

Images work out of the box: MinIO stands in for R2 (console at http://localhost:9001, `minioadmin` / `minioadmin`). Questions from material need `OPENAI_API_KEY` in `backend/.env`.

Then open http://localhost:3000. `make help` lists the rest: `make logs`, `make status`, `make down`,
`make test`, `make check`, `make e2e`. Without Docker, start your own Postgres and Redis (the URLs
are in `backend/.env`, created for you from `backend/.env.example`) and use `make up SKIP_DOCKER=1`.

By hand, if you prefer separate terminals:

```bash
docker compose up -d --wait postgres redis minio  # Postgres, Redis, MinIO

cd backend
cp .env.example .env                              # development settings
uv sync
uv run alembic upgrade head
uv run python -m app.cli create-admin --login aizhan --first-name Aizhan --last-name Bekova   # prints a password once
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

The backend tests default to `postgresql+asyncpg://postgres@localhost:5432/aary_test`. If your Postgres needs a password (the docker one does), set `AARY_TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/aary_test`.

GitHub Actions runs the first two groups on every push to `main`.

## Documents

| | |
|---|---|
| `CLAUDE.md` | the rules of the project |
| `docs/admin.md` | what an admin can and cannot do |
| `docs/protocol.md` | how a live game talks (WebSocket messages, scoring, anti-cheat, rate limits) |
| `docs/contest-scoring.md` | how a contest is scored and ranked |
| `docs/deploy.md` | running it in containers, what a proxy in front must do, backups |
| `docs/load-test.md` | the load test and its results |

## Roadmap

1. Design foundation and component kitchen sink (`/design`): done
2. Player flow screens: done
3. Host and teacher screens: done
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

## Workflow

- Work happens on `dev`; only the owner touches `main`. No pull requests.
- Commits are atomic: one logical change each, building and passing tests at every commit.

## License

GNU GPL v3, see `LICENSE`.