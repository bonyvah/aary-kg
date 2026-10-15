# Browser tests

Real browsers against a real stack: sign-in, user management and an admin correcting a finished game, a quiz and a whole contest with two
jury members, and a live game with a host and phone-sized players (join by link, refused names,
kick, shuffle, refresh in the middle, early close, podium, report). They are the checks of last
resort: they only pass when the frontend, the backend, Postgres and Redis all work together.

## Run

1. Start Postgres and Redis, the backend and the web app (see the README at the repo root). Run the
   backend with `AARY_ALLOWED_ORIGINS=http://localhost:3000`, which `backend/.env.example` already has.
2. Make sure an admin exists (it only manages users and games; the tests create the regular users they need): `cd backend && uv run python -m app.cli create-admin --login qa --name "QA"`
   (it prints a password once).
3. Once: `cd frontend && pnpm exec playwright install chromium`
4. `cd frontend && E2E_LOGIN=qa E2E_PASSWORD='...' pnpm e2e`

`pnpm e2e admin` (or `contest`, `game`) runs one file. Other settings: `E2E_BASE_URL` (default
`http://localhost:3000`), `E2E_CHROMIUM` (path to a Chromium you already have).

The tests create users, quizzes, contests and games with random names and leave them behind:
**run them against a development database, never a real one.**

The UI checks use the Russian texts (`ru`).
