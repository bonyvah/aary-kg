"""The live game: rules and transitions. No FastAPI and no sockets in here, only a state repository
(Redis) and a hub to tell people what happened. That is what makes it unit-testable.

Who drives: the host sends start/next/kick/end, and on the podium rules on suspected cheaters. The
server owns the clock: a timer closes the question at its deadline, and the last answer closes it
early. Every transition takes the game's lock and re-checks the phase, so the timer, an early close
and a host `next` can race safely, on one instance or many.
"""

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from app.game import anticheat, nicknames
from app.game import protocol as p
from app.game.characters import is_character, random_character
from app.game.hub import Hub
from app.game.models import FinishedGame, GameError, GameState, PlayerState
from app.game.scoring import points
from app.game.state_repo import GameStateRepo

log = logging.getLogger(__name__)

MAX_PLAYERS = 200
# The question closes this long after its deadline, so answers that were in flight still count.
TIMER_GRACE_MS = 400
# Answer times are reduced by the measured one-way delay, but never by more than this.
MAX_LATENCY_MS = 300
LEADERBOARD_TOP = 5
PODIUM = 3

OnFinished = Callable[[FinishedGame], Awaitable[None]]


class GameEngine:
    def __init__(self, repo: GameStateRepo, hub: Hub, on_finished: OnFinished | None = None) -> None:
        self.repo = repo
        self.hub = hub
        self.on_finished = on_finished
        self._tasks: set[asyncio.Task[None]] = set()

    # --- small helpers ---------------------------------------------------------------------

    async def _game(self, game_id: str) -> GameState:
        state = await self.repo.get_game(game_id)
        if state is None:
            raise GameError("GAME_NOT_FOUND")
        return state

    async def _emit(self, game_id: str, audience: str, event: p._Out, exclude: str | None = None) -> None:
        await self.hub.publish(game_id, audience, p.dump(event), exclude)

    async def audit(self, game_id: str, type_: str, **data: Any) -> None:
        await self.repo.add_audit(game_id, {"at": await self.repo.now_ms(), "type": type_, **data})

    @staticmethod
    def _standings(players: list[PlayerState]) -> list[p.Standing]:
        """Best first. Equal scores: whoever was faster on their correct answers, then by name."""
        ordered = sorted(players, key=lambda x: (-x.score, x.time_ms, x.nickname.casefold(), x.id))
        return [
            p.Standing(id=x.id, nickname=x.nickname, character=x.character, score=x.score, rank=i + 1)
            for i, x in enumerate(ordered)
        ]

    @staticmethod
    def _public(players: list[PlayerState]) -> list[p.PlayerPublic]:
        ordered = sorted(players, key=lambda x: x.nickname.casefold())
        return [p.PlayerPublic(id=x.id, nickname=x.nickname, character=x.character) for x in ordered]

    @staticmethod
    def _question(quiz: dict[str, Any], state: GameState, rnd: int) -> dict[str, Any]:
        return quiz["questions"][state.order[rnd]]

    def _player_question(self, quiz: dict[str, Any], state: GameState, rnd: int) -> p.PlayerQuestion:
        q = self._question(quiz, state, rnd)
        return p.PlayerQuestion(
            index=rnd + 1,
            total=len(state.order),
            text=q["text"],
            seconds=q["seconds"],
            positions=self._positions(q),
        )

    @staticmethod
    def _positions(question: dict[str, Any]) -> list[int]:
        """The shapes that have an answer text, 1 to 4."""
        return [n for n, text in enumerate(question["answers"], start=1) if str(text).strip()]

    def _host_question(self, quiz: dict[str, Any], state: GameState, rnd: int) -> p.HostQuestion:
        q = self._question(quiz, state, rnd)
        return p.HostQuestion(
            index=rnd + 1,
            total=len(state.order),
            text=q["text"],
            seconds=q["seconds"],
            positions=self._positions(q),
            answers=list(q["answers"]),
        )

    # --- before the game ---------------------------------------------------------------------

    async def create_game(self, owner_id: str, quiz: dict[str, Any]) -> GameState:
        """`quiz` is {id, title, questions: [{id, text, answers[4], correct, seconds}]}: a snapshot,
        so editing the quiz later does not change a game that is running."""
        game_id = uuid.uuid4().hex
        state = GameState(
            id=game_id,
            owner_id=owner_id,
            quiz_id=str(quiz["id"]),
            pin=await self.repo.reserve_pin(game_id),
            created_ms=await self.repo.now_ms(),
        )
        await self.repo.create_game(state, quiz)
        await self.audit(game_id, "game.created", owner=owner_id, quiz=str(quiz["id"]))
        return state

    async def lookup_pin(self, pin: str) -> GameState:
        if not (len(pin) == 6 and pin.isascii() and pin.isdigit()):
            raise GameError("PIN_INVALID")
        game_id = await self.repo.game_id_for_pin(pin)
        state = await self.repo.get_game(game_id) if game_id else None
        if state is None:
            raise GameError("GAME_NOT_FOUND")
        return state

    async def joinable(self, pin: str) -> GameState:
        state = await self.lookup_pin(pin)
        if state.phase == "ended":
            raise GameError(
                "GAME_ENDED"
            )  # a game in progress can still be joined: the player plays from the next question
        return state

    async def join(self, pin: str, nickname: str) -> tuple[GameState, PlayerState]:
        state = await self.joinable(pin)
        try:
            clean = nicknames.validate(nickname)
        except nicknames.NicknameError as e:
            raise GameError(e.code) from None
        if await self.repo.player_count(state.id) >= MAX_PLAYERS:
            raise GameError("GAME_FULL")
        player = PlayerState(id=uuid.uuid4().hex, nickname=clean, character=random_character())
        if not await self.repo.add_player(state.id, player, nicknames.skeleton(clean)):
            raise GameError("NICKNAME_TAKEN")
        await self.audit(state.id, "player.joined", player=player.id, nickname=clean)
        await self._lobby_updated(state.id)
        return state, player

    async def _lobby_updated(self, game_id: str) -> None:
        players = await self.repo.get_players(game_id)
        await self._emit(game_id, "all", p.LobbyUpdated(players=self._public(players)))

    async def set_character(self, game_id: str, player_id: str, character: Any) -> None:
        state = await self._game(game_id)
        if state.phase != "lobby":
            raise GameError("INVALID_STATE")
        if not is_character(character):
            raise GameError("CHARACTER_INVALID")
        player = await self.repo.get_player(game_id, player_id)
        if player is None:
            raise GameError("UNKNOWN_PLAYER")
        player.character = {k: character[k] for k in ("shape", "color", "face")}
        await self.repo.save_players(game_id, [player])
        await self._lobby_updated(game_id)

    async def kick(self, game_id: str, player_id: str) -> None:
        player = await self.repo.get_player(game_id, player_id)
        if player is None:
            return
        await self._emit(game_id, f"p:{player_id}", p.Kicked())
        await self.repo.remove_player(game_id, player_id, nicknames.skeleton(player.nickname))
        await self.audit(game_id, "player.kicked", player=player_id, nickname=player.nickname)
        await self._lobby_updated(game_id)

    # --- snapshots: what a client is told when it connects (or reconnects) ----------------------

    async def player_snapshot(self, game_id: str, player_id: str) -> p.StateEvent:
        state = await self._game(game_id)
        players = await self.repo.get_players(game_id)
        me = next((x for x in players if x.id == player_id), None)
        if me is None:
            raise GameError("UNKNOWN_PLAYER")
        standings = self._standings(players)
        you = next(s for s in standings if s.id == player_id)
        event = p.StateEvent(phase=state.phase, you=you, players=self._public(players))
        if state.phase == "lobby":
            return event
        quiz = await self.repo.get_quiz(game_id)
        if state.phase == "question":
            now = await self.repo.now_ms()
            event.question = self._player_question(quiz, state, state.round)
            event.remaining_ms = max(0, state.deadline_ms - now)
            mine = (await self.repo.get_answers(game_id, state.round)).get(player_id)
            event.answered = mine["position"] if mine else None
        elif state.phase == "counts":
            event.question = self._player_question(quiz, state, state.round)
            correct = self._question(quiz, state, state.round)["correct"]
            result = (await self.repo.get_results(game_id, state.round)).get(player_id)
            event.reveal = p.Reveal(correct=correct, points=result["points"] if result else 0)
            # What they tapped, so the results screen can say right, wrong or too late.
            event.answered = result["position"] if result else None
        elif state.phase == "leaderboard":
            event.question = self._player_question(quiz, state, state.round)  # for «question 2 of 5»
            event.top = standings[:LEADERBOARD_TOP]
        else:
            event.top = standings[:PODIUM]
        return event

    async def host_snapshot(self, game_id: str) -> p.HostStateEvent:
        state = await self._game(game_id)
        players = await self.repo.get_players(game_id)
        quiz = await self.repo.get_quiz(game_id)
        event = p.HostStateEvent(
            game_id=state.id,
            pin=state.pin,
            phase=state.phase,
            total=len(quiz["questions"]),
            players=self._public(players),
        )
        if state.phase in ("question", "counts"):
            event.question = self._host_question(quiz, state, state.round)
            answers = await self.repo.get_answers(game_id, state.round)
            event.answered = len(answers)
            if state.phase == "question":
                event.remaining_ms = max(0, state.deadline_ms - await self.repo.now_ms())
            else:
                event.counts = self._counts(answers)
                event.correct = self._question(quiz, state, state.round)["correct"]
        elif state.phase in ("leaderboard", "ended"):
            event.standings = self._standings(players)
        if state.phase in ("counts", "leaderboard", "ended"):
            event.cheaters = await self._cheaters(state, players)
        return event

    @staticmethod
    def _counts(answers: dict[str, dict[str, Any]]) -> list[int]:
        counts = [0, 0, 0, 0]
        for a in answers.values():
            counts[a["position"] - 1] += 1
        return counts

    # --- host commands -----------------------------------------------------------------------

    async def start(self, game_id: str) -> None:
        async with self.repo.lock(game_id):
            state = await self._game(game_id)
            if state.phase != "lobby":
                raise GameError("INVALID_STATE")
            if await self.repo.player_count(game_id) == 0:
                raise GameError("NO_PLAYERS")
            quiz = await self.repo.get_quiz(game_id)
            order = list(range(len(quiz["questions"])))
            state.order = order
            state.started_ms = await self.repo.now_ms()
            await self.audit(game_id, "game.started", order=order)
            await self._begin_question(state, quiz, 0)

    async def next(self, game_id: str, from_phase: str | None = None) -> None:
        """Host's «continue»: question -> close early, results -> leaderboard, leaderboard -> next/end.

        `from_phase` is the screen the host pressed it on. When the game is no longer there, the
        press is stale (a double click, or the timer got there first) and does nothing.
        """
        async with self.repo.lock(game_id):
            state = await self._game(game_id)
            if from_phase is not None and state.phase != from_phase:
                return
            if state.phase in ("counts", "leaderboard") and await self._cheaters(
                state, await self.repo.get_players(game_id)
            ):
                raise GameError("CHEATERS_UNRESOLVED")  # the host rules on every suspect first
            if state.phase == "question":
                await self._close_locked(state)
            elif state.phase == "counts":
                await self._leaderboard_locked(state)
            elif state.phase == "leaderboard":
                if state.round + 1 < len(state.order):
                    await self._begin_question(state, await self.repo.get_quiz(game_id), state.round + 1)
                else:
                    await self._end_locked(state)
            else:
                raise GameError("INVALID_STATE")

    async def end(self, game_id: str) -> None:
        async with self.repo.lock(game_id):
            state = await self._game(game_id)
            if state.phase == "ended":
                return
            if state.phase == "lobby":
                # Nothing was played: nothing to keep. The game just ends.
                state.phase = "ended"
                state.finished_ms = await self.repo.now_ms()
                await self.repo.save_game(state)
                await self._emit(game_id, "all", p.Closed())
                return
            await self._end_locked(state)

    # --- transitions (the game lock is held) ----------------------------------------------------

    async def _begin_question(self, state: GameState, quiz: dict[str, Any], rnd: int) -> None:
        question = self._question(quiz, state, rnd)
        now = await self.repo.now_ms()
        state.phase = "question"
        state.round = rnd
        state.question_started_ms = now
        state.deadline_ms = now + question["seconds"] * 1000
        await self.repo.save_game(state)
        await self.audit(state.id, "question.started", round=rnd, question=question["id"])
        await self._emit(
            state.id, "players", p.QuestionStarted(question=self._player_question(quiz, state, rnd))
        )
        await self._emit(
            state.id, "host", p.HostQuestionStarted(question=self._host_question(quiz, state, rnd))
        )
        self._schedule_close(state.id, rnd, question["seconds"] * 1000 + TIMER_GRACE_MS)

    def _schedule_close(self, game_id: str, rnd: int, delay_ms: int) -> None:
        async def timer() -> None:
            await asyncio.sleep(delay_ms / 1000)
            try:
                await self.close_question(game_id, rnd)
            except Exception:
                log.exception("closing question %s of game %s failed", rnd, game_id)

        task = asyncio.create_task(timer())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def close_question(self, game_id: str, rnd: int) -> bool:
        """Closes question `rnd` if it is still the open one. Safe to call twice or late."""
        try:
            async with self.repo.lock(game_id):
                state = await self._game(game_id)
                if state.phase != "question" or state.round != rnd:
                    return False
                await self._close_locked(state)
                return True
        except GameError as e:
            if e.code in ("BUSY", "GAME_NOT_FOUND"):
                return False  # someone else is already moving the game on
            raise

    async def _close_locked(self, state: GameState) -> None:
        game_id, rnd = state.id, state.round
        quiz = await self.repo.get_quiz(game_id)
        question = self._question(quiz, state, rnd)
        correct, total_ms = question["correct"], question["seconds"] * 1000
        players = {x.id: x for x in await self.repo.get_players(game_id)}
        answers = await self.repo.get_answers(game_id, rnd)

        results: dict[str, dict[str, Any]] = {}
        for pid, a in answers.items():
            player = players.get(pid)
            if player is None:  # kicked while the question was open
                continue
            ok = a["position"] == correct
            earned = points(ok, total_ms - a["ms"], total_ms)
            player.score += earned
            if ok:
                player.correct += 1
                player.time_ms += a["ms"]
            results[pid] = {"position": a["position"], "ms": a["ms"], "points": earned, "correct": ok}
        await self.repo.save_players(game_id, [players[pid] for pid in results])
        await self.repo.put_results(game_id, rnd, results)

        state.phase = "counts"
        await self.repo.save_game(state)
        standings = {s.id: s for s in self._standings(list(players.values()))}
        correct_pos = correct
        for pid, player in players.items():
            reveal = p.Reveal(correct=correct_pos, points=results.get(pid, {}).get("points", 0))
            event = p.QuestionClosed(reveal=reveal, score=player.score, rank=standings[pid].rank)
            await self._emit(game_id, f"p:{pid}", event)
        await self._emit(
            game_id, "host", p.HostQuestionClosed(counts=self._counts(answers), correct=correct_pos)
        )
        await self.audit(game_id, "question.closed", round=rnd, answered=len(results))
        await self._publish_cheaters(state)

    async def _leaderboard_locked(self, state: GameState) -> None:
        players = await self.repo.get_players(state.id)
        standings = self._standings(players)
        state.phase = "leaderboard"
        await self.repo.save_game(state)
        for s in standings:
            await self._emit(state.id, f"p:{s.id}", p.Leaderboard(top=standings[:LEADERBOARD_TOP], you=s))
        await self._emit(state.id, "host", p.HostLeaderboard(standings=standings))

    async def _end_locked(self, state: GameState) -> None:
        if state.phase == "question":
            await self._close_locked(state)  # players still get the points of the open question
        game_id = state.id
        players = await self.repo.get_players(game_id)
        state.phase = "ended"
        state.finished_ms = await self.repo.now_ms()
        await self.repo.save_game(state)
        await self.audit(game_id, "game.ended", players=len(players))
        await self._save_finished(state)
        await self._publish_ended(state)

    async def _results(self, state: GameState) -> dict[int, dict[str, dict[str, Any]]]:
        return {r: await self.repo.get_results(state.id, r) for r in range(state.round + 1)}

    async def _save_finished(self, state: GameState) -> None:
        """Writes the game to the database (again, after a ruling: the write replaces the earlier one)."""
        if self.on_finished is None:
            return
        players = await self.repo.get_players(state.id)
        standings = self._standings(players)
        finished = FinishedGame(
            game=state,
            quiz=await self.repo.get_quiz(state.id),
            players=players,
            standings=[{"id": s.id, "rank": s.rank, "score": s.score} for s in standings],
            results=await self._results(state),
            signals=await self.repo.signal_counts(state.id),
            audit=await self.repo.get_audit(state.id),
        )
        try:
            await self.on_finished(finished)
        except Exception:
            # The players still get their podium. Redis keeps the game for its TTL.
            log.exception("saving finished game %s failed", state.id)

    async def _publish_ended(self, state: GameState) -> None:
        players = await self.repo.get_players(state.id)
        standings = self._standings(players)
        for s in standings:
            await self._emit(state.id, f"p:{s.id}", p.GameEnded(top=standings[:PODIUM], you=s))
        cheaters = await self._cheaters(state, players)
        await self._emit(
            state.id, "host", p.HostGameEnded(game_id=state.id, standings=standings, cheaters=cheaters)
        )

    async def _cheaters(self, state: GameState, players: list[PlayerState]) -> list[p.Cheater]:
        """Players whose screen was left (tab, another window, full screen) since the host last ruled
        on them, with the reasons that are new."""
        counts = await self.repo.signal_counts(state.id)
        suspects = []
        for player in players:
            mine = counts.get(player.id, {})
            fresh = {k: mine.get(k, 0) - player.ruled_signals.get(k, 0) for k in anticheat.KINDS}
            if any(fresh[k] > 0 for k in anticheat.SUSPECT_KINDS):
                suspects.append(
                    p.Cheater(
                        player_id=player.id,
                        nickname=player.nickname,
                        flags=[p.CheaterFlag(kind=k, count=n) for k, n in fresh.items() if n > 0],
                    )
                )
        return suspects

    async def _publish_cheaters(self, state: GameState) -> None:
        cheaters = await self._cheaters(state, await self.repo.get_players(state.id))
        await self._emit(state.id, "host", p.CheatersUpdated(cheaters=cheaters))

    async def rule(self, game_id: str, player_id: str, action: str) -> None:
        """Host, after a question or on the podium: remove a suspected cheater, zero their score, void
        the last question's points, or let them off. Until every suspect is ruled on, the game does not
        move on. On the podium the saved game and everybody's screen follow."""
        async with self.repo.lock(game_id):
            state = await self._game(game_id)
            if state.phase not in ("counts", "leaderboard", "ended"):
                raise GameError("INVALID_STATE")
            player = await self.repo.get_player(game_id, player_id)
            if player is None:
                raise GameError("UNKNOWN_PLAYER")
            if action == "kick":
                await self._emit(game_id, f"p:{player_id}", p.Kicked())
                await self.repo.remove_player(game_id, player_id, nicknames.skeleton(player.nickname))
            elif action in ("zero", "void_last", "mercy"):
                if action == "zero":
                    player.score = 0
                elif action == "void_last":
                    last = (await self.repo.get_results(game_id, state.round)).get(player_id)
                    if last is not None:
                        player.score -= int(last["points"])
                        last["points"] = 0
                        await self.repo.put_results(game_id, state.round, {player_id: last})
                player.ruled_signals = dict((await self.repo.signal_counts(game_id)).get(player_id, {}))
                await self.repo.save_players(game_id, [player])
            else:
                raise GameError("BAD_MESSAGE")
            await self.audit(
                game_id, "player.ruled", player=player_id, nickname=player.nickname, action=action
            )
            if state.phase == "ended":
                await self._save_finished(state)
                await self._publish_ended(state)
            else:
                if state.phase == "leaderboard":
                    await self._leaderboard_locked(state)  # the standings changed: show them again
                await self._lobby_updated(game_id)
                await self._publish_cheaters(state)

    # --- player actions -------------------------------------------------------------------------

    async def answer(self, game_id: str, player_id: str, position: int, latency_ms: int = 0) -> None:
        state = await self._game(game_id)
        if state.phase != "question":
            raise GameError("ANSWER_CLOSED")
        if await self.repo.get_player(game_id, player_id) is None:
            raise GameError("UNKNOWN_PLAYER")
        quiz = await self.repo.get_quiz(game_id)
        if position not in self._positions(self._question(quiz, state, state.round)):
            raise GameError("ANSWER_INVALID")  # a shape the question does not have
        now = await self.repo.now_ms()
        latency = min(max(latency_ms, 0), MAX_LATENCY_MS)
        if now - latency > state.deadline_ms:
            raise GameError("ANSWER_CLOSED")
        total_ms = state.deadline_ms - state.question_started_ms
        # The client's clock is never read: only when the server got the answer, minus the delay.
        elapsed = min(max(0, now - state.question_started_ms - latency), total_ms)
        rnd = state.round
        if not await self.repo.put_answer(
            game_id, rnd, player_id, {"position": position, "ms": elapsed, "at": now}
        ):
            raise GameError("ALREADY_ANSWERED")
        fresh = await self._game(game_id)
        if fresh.phase != "question" or fresh.round != rnd:
            raise GameError("ANSWER_CLOSED")  # the question closed while this answer was arriving
        await self.audit(game_id, "answer", player=player_id, round=rnd, position=position, ms=elapsed)
        answered, total = await self.repo.answer_count(game_id, rnd), await self.repo.player_count(game_id)
        await self._emit(game_id, "host", p.AnswerCount(answered=answered, total=total))
        if answered >= total:
            await self.close_question(game_id, rnd)

    async def signal(self, game_id: str, player_id: str, kind: str) -> None:
        state = await self._game(game_id)
        if state.phase not in ("question", "counts", "leaderboard"):
            return
        if await self.repo.add_signal(game_id, player_id, kind):
            await self.audit(game_id, "signal", player=player_id, kind=kind)
            if kind in anticheat.SUSPECT_KINDS and state.phase in ("counts", "leaderboard"):
                await self._publish_cheaters(state)
