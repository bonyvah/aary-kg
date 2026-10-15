# Live game protocol (version 1)

How a live game works between the browsers and the server. The code is in `backend/app/game/`
(`protocol.py` has every message as a typed model, `engine.py` has the rules).

## Principles
- **The server is the only clock and the only judge.** Answer times are measured by the server (Redis `TIME`, so every app instance agrees). The client never sends a time, and any extra fields in a message are ignored.
- **The correct answer is never sent before the reveal**, to players or to the host screen. Players don't even get the answer texts: they see the question and four shapes, the host screen shows the answers.
- **Rules live in the engine.** The WebSocket handlers only move messages. Every transition (start, close, next, end) takes a per-game Redis lock and re-checks the phase, so the timer, the last answer and the host can race safely, on one instance or many.
- **Redis is live state only.** When a game ends it is written to Postgres (game, players, answers, flags, audit trail). A game that is never finished disappears from Redis after 12 hours and is not saved.
- Errors are stable **codes** (`ANSWER_CLOSED`), never text. The frontend translates them.

## Message format
JSON objects, camelCase keys, `"v": 1` and `"type"` on every message. A client message with another `v`, an unknown `type`, a wrong field type or extra bytes beyond 2 KB is refused (`BAD_MESSAGE`; over 2 KB the socket is closed with 1009).

## Getting in

| Step | Who | How |
|---|---|---|
| Create a lobby | host (staff session) | `POST /games {quizId, shuffleQuestions}` returns `{gameId, pin}`. The quiz is copied into the game. |
| Check a PIN | player | `GET /games/pin/{pin}` returns 204, or `PIN_INVALID` / `GAME_NOT_FOUND` / `GAME_STARTED` |
| Join | player | `POST /games/join {pin, nickname}` returns `{token, player}`. The token is a JWT good for this player in this game only (12 h); staff routes refuse it. |
| Host socket | host | `GET /ws/host/{gameId}`, authenticated by the staff session cookie. Only the game's owner or an admin. |
| Player socket | player | `GET /ws/play`, then the **first message** is `{type:"hello", token}` within 5 s (the token is not in the URL, URLs get logged). |

Close codes: `4400` bad first message, `4401` not authenticated, `4403` not allowed (not your game, or you were kicked), `4429` too many connections, `1009` message too big.

**One connection per player.** A newer connection with the same token replaces the older one on any instance: the old one receives `replaced` and is closed. The host screen works the same way. Reconnecting is just connecting again: the first message after hello is a `state` snapshot (host: `host.state`) with everything needed to redraw the current screen, including the player's own answer and the time left.

## Phases
`lobby` -> `question` -> `counts` (results) -> `leaderboard` -> `question` ... -> `ended`

The host moves the game with `next`: during a question it closes it early, on the results screen it shows the leaderboard, on the leaderboard it starts the next question (or ends the game after the last). A question also closes by itself when time is up (+0.4 s grace for answers in flight) and when everybody has answered.

## Client -> server

Player (after `hello`):

| type | fields | notes |
|---|---|---|
| `hello` | `token` | first message only |
| `answer` | `position` 1-4 | 1 triangle, 2 diamond, 3 circle, 4 square. One answer per question; the first one stands. |
| `signal` | `kind` `TAB_BLUR` or `PASTE` | a browser hint for the host's report. Only counted while the game is running, capped per player. |
| `pong` | `n` | answer to the server's `ping`. The server halves the round trip to estimate the delay (max 300 ms) and takes it off the answer time. |
| `character.set` | `character {shape, color, face}` | lobby only; the three ids must come from the fixed lists |

Host: `start`, `next`, `kick {playerId}`, `end`, `settings {shuffleQuestions}` (lobby only).

## Server -> client

To a player: `state`, `lobby.updated {players}`, `question.started {question}`, `answer.accepted {position}`, `question.closed {reveal {correct, points}, score, rank}`, `leaderboard {top (best 5), you}`, `game.ended {top (best 3), you}`, `ping {n}`, `kicked`, `replaced`, `game.closed`, `error {code}`.

To the host: `host.state`, `lobby.updated`, `question.started {question with answers[4]}`, `answer.count {answered, total}`, `question.closed {counts[4], correct}`, `leaderboard {standings}`, `game.ended {gameId, standings}`, `replaced`, `error {code}`.

A `question` for players is `{index (from 1), total, text, seconds}`. For the host it also has `answers`.

## Scoring
A correct answer scores `500 + 500 x (time left / time allowed)`, so 500 to 1000. A wrong or missing answer scores 0. Time left is measured by the server. The leaderboard orders by score, then by the total time of the correct answers (faster first), then by nickname: there are no tied ranks, so the podium always has a first, second and third.

## Anti-cheat
- **Nicknames** are trimmed, 1 to 20 characters, no invisible characters. They are compared by a "skeleton" (case, spaces, punctuation and Cyrillic look-alikes of Latin letters ignored), so "Alex" and "Аlех" are the same name. Names containing "admin", "host", "ведущий" ... (look-alikes and digit swaps included) or words from `nickname_blocklist.txt` are refused. Extend that file for the community.
- **Rate limits** (Redis counters): PIN checks 60/min per IP, joins 30/min per IP, WebSocket connections 60/min per IP, player messages 100 per 10 s per player.
- **Flags for the host's report** (hints, never proof, nobody is removed because of them):

| kind | meaning |
|---|---|
| `TAB_BLUR`, `PASTE` | what the browser reported, with counts |
| `FAST_ANSWERS` | two or more correct answers in under 0.4 s |
| `SAME_TIMING` | on two or more questions, three or more players answered within 0.15 s of each other |
| `STEADY_TIMING` | at least 5 answers, all right, with response times that barely vary (stdev under 0.12 s) |

- **Audit trail:** every join, connect, answer (with the measured time), kick, signal and phase change is stored with a timestamp (the first 5000 events) and saved with the game.

## Question order
`shuffleQuestions` plays the questions in a random order, the same for everybody. Per-player question or answer order is not used: everybody answers the question that is on the host screen, and players only see shapes, so the shapes must mean the same thing to everyone.
