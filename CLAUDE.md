# CLAUDE.md — aary kg

Kahoot-inspired live quiz platform with stricter anti-cheat, plus a jury-scored contest mode.
Small userbase (a handful of admins, a few dozen users). Do not over-engineer.

## Working rules (read first)

- Work in the order of the build phases below. Do NOT jump ahead to a later phase.
- Phases 1-3 are UI ONLY with mock data. No backend, no database, no auth logic, no WebSockets until Phase 5.
- Before inventing any visual decision not covered here, ask me.
- Use plan mode for each phase, show the plan, wait for approval.
- Keep changes small and reviewable. One component or one screen per task.
- After building UI, tell me which route to open so I can check it visually. Do not claim a UI is "polished" without me seeing it.

## Product

### Roles
- **admin**: few of them. Create/disable users, see everything, manage contests. No self-registration anywhere.
- **user**: created by admin. Creates quizzes, hosts live games, creates contests, can be a jury member.
- **player**: no account, no auth. Joins a live game with a game PIN + nickname.

### Features
- Live game: host starts a game, players join by PIN, server pushes questions, players answer, leaderboard + podium.
- Individual players only. NO teams, NO reactions, NO power-ups, NO marketplace.
- Contest: a set of jury members each give points to participants/entries by criteria. Final result is the aggregate. Users can create contests and be juries.
- Anti-cheat is a core differentiator (see Anti-cheat).

## Tech stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: FastAPI (Python 3.12+), async, WebSockets for live games
- DB: PostgreSQL (SQLAlchemy 2.0 async + Alembic)
- Live game state: in-memory first, behind an interface so Redis can replace it later
- Auth: JWT for admin/user; players get a short-lived game-scoped token
- One backend service, one frontend, one Postgres. No microservices.

### Next.js usage rules
- This is a client-heavy realtime app. Use Next.js mainly for routing, layouts and the build pipeline.
- NO Next.js API routes, NO Server Actions for business logic. FastAPI is the single backend.
- Game screens are client components. No SSR needed for them.

## Design system (Kahoot-inspired, NOT a copy)

Take the feel: loud, playful, chunky, high contrast. Do NOT copy Kahoot's logo, assets, copy, or CSS. Use our own name and brand.

### Tokens (define once in tailwind config / CSS variables, use only these)
- Colors:
  - primary `#1368ce`
  - error/red `#e21b3c`
  - warning/orange `#eb670f`
  - success/green `#26890c`
  - purple brand `#46178f`, dark purple `#25076b`, light purple `#864cbf`
  - yellow `#ffc00a`
  - greys: `#ffffff #fafafa #f2f2f2 #e9e9e9 #ccc #b2b2b2 #6e6e6e #333`
- Answer tile colors (always paired with a shape for accessibility):
  red + triangle, blue + diamond, yellow + circle, green + square
- Font: Montserrat, weights 500 / 700 / 900. Self-host via next/font.
- Spacing: 4px base grid only (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). No arbitrary values.
- Radii: 4, 8, 12, 16, 24, full.
- Type scale (px): 11, 12, 14, 16, 20, 24, 32, 40, 48.

### Style rules
- Buttons are chunky with a solid darker bottom edge (about 4px) and a press-down effect. Not soft shadows.
- Big bold headings (700-900), generous tap targets (min 44px), mobile-first for the player flow.
- Flat solid color blocks. NO gradients as decoration, NO glassmorphism, NO neumorphism, NO generic "SaaS dashboard card with soft shadow" look, NO emoji as icons.
- Icons: one consistent icon set (lucide-react). Answer shapes are custom SVG.
- Motion: short and punchy (150-250ms). Timer bar, score count-up, podium reveal. Respect `prefers-reduced-motion`.
- Player screens: portrait phone layout first. Host screen: landscape, projector-friendly, very large type.
- Every interactive element needs hover, active, focus-visible and disabled states.

### Do NOT use the apple-design skill for this project
Its minimal soft look conflicts with this design language. Tokens above win over any skill guidance.

### Reference screenshots
Put them in `/design-refs/` (join screen, lobby, question + 4 answer tiles, answer feedback, leaderboard, podium, quiz editor). Use them for layout and mood only. Never copy assets.

## Build phases

1. **Foundation**: tokens, Montserrat, base components (Button, Input, Card, Badge, AnswerTile, TimerBar, Avatar, Modal, Toast, Podium, LeaderboardRow) and a `/design` kitchen-sink route showing every component in every state. STOP and wait for my visual review.
2. **Player flow** (mock data): join (PIN) -> nickname -> lobby -> question -> answered/wait -> result -> leaderboard -> podium.
3. **Host + user screens** (mock data): login, dashboard, quiz editor, host lobby, host live view (question, answer counts, leaderboard), game report.
4. **Admin + contest screens** (mock data): user management, contest create, jury scoring screen, contest results.
5. **Backend**: DB schema + migrations, auth, REST CRUD, WebSocket game engine, anti-cheat, then wire the screens to real data.
6. **Hardening**: rate limits, tests, deploy.

## Anti-cheat (server-authoritative, matters from Phase 5)

The server is the source of truth. The client is never trusted.

- Server owns the clock and timer. Answer time is measured server-side, with latency compensation. Client-sent timestamps are ignored.
- Questions are sent only when they start. Correct answers are never sent to the client before the reveal.
- One active connection per player. Detect duplicate joins and rejoin with a token.
- Server validates every answer: right game, right question, still open, not already answered.
- Rate limit connections and messages per IP and per player.
- Nickname rules: unique per game, profanity and impersonation filter, host can kick.
- Client signals (tab blur / visibility change, focus loss, paste, devtools heuristics) are only SIGNALS. Log them with timestamps and show them to the host as flags. Never treat them as proof or auto-ban on them alone.
- Suspicious-pattern flags for the host: implausibly fast answers, perfect accuracy with unusually low variance in response time, identical answer timing across several players.
- Randomize question order and answer order per player when the host enables it.
- Store an audit trail of events per game for post-game review.

## Code conventions

### Frontend
- TypeScript strict. No `any`.
- Components in `src/components/ui` (base) and `src/components/game` (feature). Screens in `src/app`.
- Tailwind only, driven by tokens. No inline styles, no one-off CSS files.
- Mock data lives in `src/mocks` and is typed with the same types the API will use, so swapping is easy.
- Accessibility: semantic HTML, labels, focus order, color never the only signal.

### Backend
- Python 3.12, FastAPI, async everywhere, Pydantic v2 models.
- Layers: routers -> services -> repositories. No business logic in routers.
- WebSocket game engine isolated in its own module with a clear message protocol (typed, versioned events).
- Config via environment variables, never committed secrets.
- Tests with pytest. The game engine and anti-cheat rules must have unit tests.

## Repo layout (target)

```
aary-kg/
  CLAUDE.md
  README.md
  design-refs/
  frontend/      # Next.js app
  backend/       # FastAPI app
  docs/          # decisions, protocol spec
```

## Open decisions (ask me, do not decide silently)
- Hosting for the FastAPI WebSocket backend and for Next.js
- Redis vs in-memory for live state
- Contest scoring model details (criteria, weights, tie-breaks)
- Product branding (logo, final wording)
