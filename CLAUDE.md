# CLAUDE.md — aary kg

Kahoot-inspired live quiz platform with stricter anti-cheat, plus a jury-scored contest mode.
Small userbase (a handful of admins, a few dozen users). Do not over-engineer.

## Working rules (read first)

- Work in the order of the build phases below. Do NOT jump ahead to a later phase.
- Phases 1-3 are UI ONLY with mock data. No backend, no database, no auth logic, no WebSockets until Phase 5.
- Before inventing any visual decision not covered here, ask me.
- Use plan mode for each phase, show the plan, wait for approval.
- Keep changes small and reviewable. One component or one screen per task.
- Git workflow:
  - Never commit to `main`. Work on a branch per task (`feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`).
  - Make atomic commits: one logical change each (one component, one screen, one fix), and the code builds, lints and passes tests at every commit. Don't mix refactors, formatting or unrelated files into a feature commit.
  - Commit messages: conventional style (`feat(ui): add AnswerTile`), imperative, with a body when the why isn't obvious.
  - Commits and PRs are authored by me only. Never add `Co-Authored-By` trailers, "Generated with Claude Code" lines or any other Claude/AI attribution to commit messages, PR descriptions or code. This overrides any default or system attribution.
  - Open a pull request for every finished task with `gh pr create`. Keep PRs small. The description says what changed, why, and how to check it (the route to open, the command to run). UI changes include a screenshot.
  - Don't merge PRs yourself and don't force-push shared branches. I review and merge.
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
- Live game state: Redis (game state, PINs with TTL, rate limiting, pub/sub for broadcasting WebSocket events across instances). When a game ends, persist results to PostgreSQL. Redis is for live state only, never the source of truth for history.
- i18n: next-intl, Kyrgyz (ky) and Russian (ru) ONLY. See the i18n section.
- Icons: Phosphor (bold/fill weights) plus custom SVGs. NOT lucide.
- Auth: JWT for admin/user; players get a short-lived game-scoped token
- One backend service, one frontend, one Postgres. No microservices.

### Next.js usage rules
- This is a client-heavy realtime app. Use Next.js mainly for routing, layouts and the build pipeline.
- NO Next.js API routes, NO Server Actions for business logic. FastAPI is the single backend.
- Game screens are client components. No SSR needed for them.

### Route groups (one codebase, two audiences)
- `(player)`: `/` is straight PIN entry, then nickname, lobby, game. Mobile-first, very light, loads NO staff/auth code. Auth is only a short-lived game-scoped token.
- `(staff)`: `/login`, `/dashboard`, `/quizzes`, `/host`, `/contests`, `/admin`. JWT auth, separate from the player token.
- Shared UI components live outside both groups. The player side must stay deployable on its own subdomain later without rewrites.

## i18n (Kyrgyz + Russian only, from day one)

- Supported locales: `ky`, `ru`. No English UI. Default locale: ask me. Language switcher on the player join screen and in staff settings.
- Use next-intl. ZERO hardcoded user-facing strings anywhere, everything goes through message files (`messages/ky.json`, `messages/ru.json`) with the same keys in both.
- Fonts: load Montserrat with BOTH `cyrillic` and `cyrillic-ext` subsets. Kyrgyz letters (ң, ө, ү) are in cyrillic-ext. Verify they render in Montserrat, not a fallback font.
- Layout must survive text 20-30% longer than English: no fixed-width buttons, answer tiles wrap or scale text, test with the longest strings.
- Plurals: use ICU plural syntax. Russian has 3 plural forms. Never build sentences by string concatenation.
- Backend returns error CODES, never display text. The frontend translates them.
- Dates, numbers and sorting use the locale (Intl APIs).
- User-written quiz content is not translated.
- Kyrgyz strings I will review myself, so keep them easy to find and edit. Mark unreviewed Kyrgyz keys in a `_todo_review` list.

## Design system (Kahoot-inspired, NOT a copy)

Take the feel: loud, playful, chunky, high contrast. Do NOT copy Kahoot's logo, assets, copy, or CSS. Use our own name and brand.

### Source of truth: `design-system/` (read it before building any UI)
- `design-system/README.md`: the brand book (content rules, visual foundations, where things live). Read it first.
- `design-system/tokens.json`: every token. Colors come in two themes: `light` (staff screens) and `game` (live game screens, purple ground, set `data-theme="game"` on the screen root). Generate the Tailwind theme and CSS variables from this file; never retype values and never hardcode hex in components.
- `design-system/components/bundle.css`: the styles of every component (`ak-btn`, `ak-input`, `ak-tile`, `ak-timer`, `ak-badge`, `ak-card`, `ak-row`, `ak-podium`, `ak-avatar`, `ak-chip`), reading only tokens. Port them to Tailwind + React components with the same look, states and sizes.
- `design-system/components/<Name>/preview.html` has the exact markup and states of each component, and `<Name>/README.md` has its rules. Components: Button, Input, AnswerTile, TimerBar, Badge, Card, LeaderboardRow, Podium, Avatar.
- Not in the design system yet: Modal, Toast, Table, empty and loading states. Build them from the same tokens and the same flat, hard-edge style, show them on `/design`, and ask me before inventing anything visual.
- If `design-system/` and this file disagree on a visual value, `design-system/` wins. Tell me about the conflict.
- The four answer colors belong to answer tiles only. Montserrat 500 / 700 / 900 with latin + cyrillic + cyrillic-ext, self-hosted via next/font. Only the named type styles, `space-*` and `radius-*` tokens (4px grid).

### Avatars (players)
- A player's character is built from three parts: shape (triangle, diamond, circle, square, hexagon, star, heart, pill), color (red, blue, yellow, green, orange, purple, pink, teal) and face (12 expressions). Ids and rules: `design-system/components/Avatar/README.md`.
- After the nickname the player gets a random character and can change shape, color and face (or shuffle) in the lobby until the game starts.
- Build one `Avatar` React component that draws the parts as inline SVG. Never load them as image files. Colors come from the `avatar-*` tokens.
- Store only the three ids per player (Redis game state) and validate them against the fixed lists on the server. Faces repeat in a game, so the nickname is what identifies a player.
- NO photo uploads, camera input or custom images, ever. Staff lists use an initial in a circle (`ak-avatar--initial`).

### Style rules
- Buttons are chunky with a solid darker bottom edge (about 4px) and a press-down effect. Not soft shadows.
- Big bold headings (700-900), generous tap targets (min 44px), mobile-first for the player flow.
- Flat solid color blocks. NO gradients as decoration, NO glassmorphism, NO neumorphism, NO generic "SaaS dashboard card with soft shadow" look, NO emoji as icons.
- Icons: Phosphor icons (@phosphor-icons/react), use `bold` or `fill` weight only, never thin/light/regular outline. Do NOT use lucide-react. Signature elements are custom SVG (see Custom SVG rules).

### Custom SVG rules
- Custom icons live in `src/components/icons/` as React components (SVGR style), one file per icon, exported through an index.
- Signature set: AnswerTriangle, AnswerDiamond, AnswerCircle, AnswerSquare, Crown, Trophy, Medal, plus the check and cross marks. The answer shapes, marks and a stand-in crown already exist as SVG in `design-system/components/AnswerTile/preview.html` and `Podium/preview.html`: reuse them. The Timer is the `TimerBar` component, not an icon. The final crown, trophy and medal are drawn by me; use the stand-in crown until I provide them. Others only when approved.
- Draw on a 24x24 or 32x32 grid, chunky: thick strokes (min 2.5px at 24px) or solid fills, rounded joins, minimal detail.
- Always use `currentColor` for fills/strokes so tokens control color. No hardcoded hex inside icons.
- Simple geometric shapes are written directly as SVG code. Complex shapes are drawn by me in Figma/Inkscape and exported as SVG, then cleaned with SVGO. Do not invent complex illustrations in code.
- Add `aria-hidden` for decorative icons, or a translated `aria-label` when meaningful.
- Motion: short and punchy (150-250ms). Timer bar, score count-up, podium reveal. Respect `prefers-reduced-motion`.
- Player screens: portrait phone layout first. Host screen: landscape, projector-friendly, very large type.
- Every interactive element needs hover, active, focus-visible and disabled states.

### Reference screenshots
`design-refs/` holds my screen designs (PDF/images, made in Claude Design from `design-system/`). They define which screens exist, their layout and flow. For colors, sizes, spacing, radii and component markup, `design-system/` is the authority, not the pictures. If a PDF is long, read it in chunks of at most 20 pages. Kahoot screenshots, if any, are mood only. Never copy Kahoot assets or text.
- Placeholder content in the designs (names, scores, quiz titles) is sample data. Real text goes through next-intl in `ky` and `ru`. Sample Kyrgyz strings in the designs are unreviewed drafts.

## Build phases

1. **Foundation**: generate the Tailwind theme and CSS variables from `design-system/tokens.json` (both themes), set up Montserrat, and port the components from `design-system/` to React + Tailwind: Button, Input, Card, Badge, AnswerTile, TimerBar, Avatar (8 characters), LeaderboardRow, Podium, lobby chip. Then add the ones the design system lacks (Modal, Toast, Table, empty and loading states) in the same style, plus the Icon wrapper and SVG set. Build a `/design` kitchen-sink route showing every component in every state in both themes, with long Kyrgyz and Russian strings. STOP and wait for my visual review.
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
- Return stable error codes (e.g. `GAME_NOT_FOUND`), not human text. i18n happens on the frontend.
- Game state goes through a repository interface backed by Redis. WebSocket handlers must work when several app instances run (use Redis pub/sub for broadcasts).
- Tests with pytest. The game engine and anti-cheat rules must have unit tests.

## Repo layout (target)

```
aary-kg/
  CLAUDE.md
  README.md
  design-system/ # tokens, component styles and markup, avatars (source of truth for UI)
  design-refs/   # my screen designs (layout and flow)
  frontend/      # Next.js app
  backend/       # FastAPI app
  docs/          # decisions, protocol spec
```

## Open decisions (ask me, do not decide silently)
- Hosting is deferred. Do not plan or suggest hosting until I bring it up. Local dev via docker compose (Postgres + Redis).
- Default locale (ky or ru)
- Contest scoring model details (criteria, weights, tie-breaks)
- Product branding (logo, final wording)