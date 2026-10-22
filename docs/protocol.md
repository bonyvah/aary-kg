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
| Create a lobby | host (staff session) | `POST /games {quizId}` returns `{gameId, pin}`. The quiz is copied into the game. |
| Check a PIN | player | `GET /games/pin/{pin}` returns 204, or `PIN_INVALID` / `GAME_NOT_FOUND` / `GAME_ENDED` (a game that is running can still be joined) |
| Join | player | `POST /games/join {pin, nickname}` returns `{token, player}`. The token is a JWT good for this player in this game only (12 h); staff routes refuse it. |
| Host ticket | host (staff session) | `POST /games/{gameId}/host-ticket` returns `{ticket}`, good for 60 s. Only the game's owner (admins do not host); otherwise `404 GAME_NOT_FOUND`. |
| Host socket | host | `GET /ws/host/{gameId}`, first message `hello {token: <ticket>}`. Not the session cookie: when the web app and the backend are on different sites, the browser does not send it to the backend. A ticket for another game, an expired one, or one from a session that has since ended closes with `4401`. |
| Next game | host (staff session) | `POST /games/{gameId}/next {quizId}` from the podium returns `{gameId, pin}`: a new game (its own report) on the same PIN, or a new PIN if the old one expired, with every player still connected. Each of them gets `game.next {token}` on their socket. Sent twice, it returns the same game. `409 INVALID_STATE` before the podium, `404 GAME_NOT_FOUND` for another host's game. |
| Player socket | player | `GET /ws/play`, then the **first message** is `{type:"hello", token}` within 5 s (the token is not in the URL, URLs get logged). |

Close codes: `4400` bad first message, `4401` not authenticated, `4403` not allowed (not your game, or you were kicked), `4429` too many connections, `1009` message too big.

**One connection per player.** A newer connection with the same token replaces the older one on any instance: the old one receives `replaced` and is closed. The host screen works the same way. Reconnecting is just connecting again: the first message after hello is a `state` snapshot (host: `host.state`) with everything needed to redraw the current screen, including the player's own answer and the time left (`remainingMs` until the question closes, reading time included, and `readingMs` until its answers open).

## Phases
`lobby` -> `question` -> `counts` (results) -> `leaderboard` -> `question` ... -> `ended`

The host moves the game with `next`. It carries `fromPhase`, the screen the host pressed it on: if the game has already moved on (a double click, or the timer closed the question first) the press is ignored instead of skipping a screen. Without it: during a question it closes it early, on the results screen it shows the leaderboard, on the leaderboard it starts the next question (or ends the game after the last). A question also closes by itself when time is up (+0.4 s grace for answers in flight) and when everybody has answered.

## Client -> server

Player (after `hello`):

| type | fields | notes |
|---|---|---|
| `hello` | `token` | first message only |
| `answer` | `position` 1-4 | 1 triangle, 2 diamond, 3 circle, 4 square. One answer per question; the first one stands. |
| `signal` | `kind` `TAB_BLUR`, `WINDOW_BLUR`, `FULLSCREEN_EXIT` or `PASTE` | a browser hint for the host's report. Only counted while the game is running, capped per player. |
| `pong` | `n` | answer to the server's `ping`. The server halves the round trip to estimate the delay (max 300 ms) and takes it off the answer time. |
| `character.set` | `character {shape, color, face}` | lobby only; the three ids must come from the fixed lists |

Host: `settings {showAnswers, scoring}` (`scoring`: `speed`, 500 to 1000 for a right answer, or `flat`, 1 per right answer with equal scores sharing the place; lobby only: a field left out keeps its value; the next game from the podium keeps them), `start`, `next {fromPhase}` (refused with `CHEATERS_UNRESOLVED` while a suspect is not ruled on), `kick {playerId}`, `end`, `quit` (stops the game and keeps nothing: no record, no report; everyone gets `game.closed`; refused once the game has ended), and, after a question or on the podium, `rule {playerId, action}` with `action` one of `kick` (remove the player), `zero` (score becomes 0), `void_last` (the last question's points are taken away) or `mercy` (no change). On the podium a ruling saves the game again and sends everyone a fresh `game.ended`; during the game it updates the standings and the host's suspect list.

## Server -> client

To a player: `state`, `lobby.updated {players}`, `question.started {question, readingMs}` (`question` has `readSeconds`, its whole reading time; the question is only read for `readingMs`, its reading time of 3 to 10 s: answers sent before it is over are refused with `ANSWER_NOT_OPEN`, and the answer time counts from then; with `answers[4]` only when the host shows them on the players' screens, never which one is right), `answer.accepted {position}`, `question.closed {reveal {correct, points}, score, rank}`, `leaderboard {top (best 5), you}`, `game.ended {top (best 3), you}`, `ping {n}`, `kicked`, `replaced`, `game.closed`, `game.next {token}` (after the podium the host plays another quiz with the players still connected: connect again with this token, to the new lobby), `error {code}`.

To the host: `host.state` (with `settings {showAnswers, scoring}`), `settings {settings}`, `lobby.updated`, `question.started {question with answers[4], readingMs}`, `answer.count {answered, total}`, `question.closed {counts[4], correct}`, `leaderboard {standings}`, `cheaters {cheaters}` (who is suspected right now: sent after every question, when a player leaves their screen while results or the leaderboard are shown, and after every ruling), `game.ended {gameId, standings, cheaters [{playerId, nickname, flags [{kind, count}]}]}` (players with `TAB_BLUR`, `WINDOW_BLUR` or `FULLSCREEN_EXIT` signals whom the host has not ruled on; `PASTE` is listed with them but is not a reason on its own), `replaced`, `error {code}`.

A `question` for players is `{index (from 1), total, text, seconds, positions}`; `positions` lists the shapes that have an answer (a question can have two or three), and an `answer` for any other shape is refused with `ANSWER_INVALID`. For the host it also has `answers`.

## Scoring
Speed scoring (the default): a correct answer in the first 0.5 s scores 1000, then the points fall evenly to 500 at the buzzer. A wrong or missing answer scores 0. The time is measured by the server, minus the measured round trip to the phone (at most 300 ms). The leaderboard orders by score, then by the total time of the correct answers (faster first), then by nickname: there are no tied ranks, so the podium always has a first, second and third. Flat scoring: 1 per correct answer, time counts for nothing, and equal scores share the place.

## Anti-cheat
- **Nicknames** are trimmed, 1 to 20 characters, no invisible characters. They are compared by a "skeleton" (case, spaces, punctuation and Cyrillic look-alikes of Latin letters ignored), so "Alex" and "Аlех" are the same name. Names containing "admin", "host", "ведущий" ... (look-alikes and digit swaps included) or words from `nickname_blocklist.txt` are refused. Extend that file for the community.
- **Rate limits** (Redis counters, per client address, see `AARY_TRUSTED_PROXY_HOPS` for how the address is found). A whole classroom often shares one public address, so joining is limited by what an attacker does, not by how many people join: **failed PIN lookups** (a wrong or malformed PIN) 20 per minute, after which that address is refused for the rest of the minute; successful PIN checks 600 per minute, joins 300 per minute, WebSocket connections 600 per minute. A refused nickname or a game that already ended does not count as a guess. Player messages are limited to 100 per 10 seconds per player. Staff login: 20 attempts per 10 minutes per address and 8 failed attempts per login (locks it for 15 minutes).
- **Flags for the host's report and podium** (hints, never proof, nobody is removed unless the host decides on the podium). What is watched is the player's screen, not how fast or evenly they answer:

| kind | meaning |
|---|---|
| `TAB_BLUR` | the player left the tab |
| `WINDOW_BLUR` | the browser window lost focus while the tab stayed visible (another window, split screen) |
| `FULLSCREEN_EXIT` | the player left full screen |
| `PASTE` | text was pasted; counted and listed, never a reason on its own |

The first three make a player a suspect on the host's podium. Older games may also carry `FAST_ANSWERS`, `SAME_TIMING` and `STEADY_TIMING`, which are no longer recorded.

- **Audit trail:** every join, connect, answer (with the measured time), kick, signal and phase change is stored with a timestamp (the first 5000 events) and saved with the game.

## Question order
`shuffleQuestions` plays the questions in a random order, the same for everybody. Per-player question or answer order is not used: everybody answers the question that is on the host screen, and players only see shapes, so the shapes must mean the same thing to everyone.
