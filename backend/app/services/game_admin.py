"""What an admin may change in a FINISHED game: the data of the game, never the quiz itself.

Points (adding, taking away, setting a total, changing what one answer is worth or whether it was
right), nicknames, who took part, and the anti-cheat flags, or the whole game. The host of the game
can read all of it and change none of it. Every change recomputes the totals and the ranking the way
the live game ranked them, and is written to the game's audit trail with who did it and when.
"""

import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.game import nicknames
from app.game.runtime import get_engine
from app.game.scoring import places
from app.models.game import Game, GamePlayer
from app.models.user import User
from app.schemas.game_admin import (
    AnswerEditIn,
    DetailAnswer,
    DetailPlayer,
    DetailQuestion,
    Edit,
    GameDetail,
)

# The first three are what is recorded now; the others are on games played before they were dropped.
FLAG_KINDS = (
    "TAB_BLUR",
    "WINDOW_BLUR",
    "FULLSCREEN_EXIT",
    "PASTE",
    "FAST_ANSWERS",
    "SAME_TIMING",
    "STEADY_TIMING",
)
BASE_POINTS = 500  # what a right answer is worth when only «right» is said


# --- loading and the audit trail -----------------------------------------------------------------


async def _load(session: AsyncSession, game_id: uuid.UUID) -> tuple[Game, list[GamePlayer]]:
    """The game and its players, locked: two admins editing at once take turns."""
    game = (
        await session.execute(select(Game).where(Game.id == game_id).with_for_update())
    ).scalar_one_or_none()
    if game is None:
        raise ApiError(404, "GAME_NOT_FOUND")
    # A game that is still being played (or was never finished) is the host's: nothing in it is corrected yet.
    live = await get_engine().repo.get_game(game_id.hex)
    if live is not None and live.phase != "ended":
        raise ApiError(409, "GAME_NOT_FINISHED")
    players = list((await session.execute(select(GamePlayer).where(GamePlayer.game_id == game_id))).scalars())
    return game, players


def _player(players: list[GamePlayer], player_id: uuid.UUID) -> GamePlayer:
    for p in players:
        if p.id == player_id:
            return p
    raise ApiError(404, "PLAYER_NOT_FOUND")


def _log(game: Game, admin: User, action: str, player: GamePlayer | None, **detail: Any) -> None:
    entry = {
        "at": int(time.time() * 1000),
        "type": "admin.edit",
        "admin": str(admin.id),
        "adminName": admin.name,
        "action": action,
        "player": str(player.id) if player else None,
        "nickname": player.nickname if player else None,
        "detail": detail,
    }
    game.audit = [*game.audit, entry]  # a new list, so the change is saved


def _answers_sum(player: GamePlayer) -> int:
    return sum(int(a["points"]) for a in player.answers)


def _recompute(game: Game, players: list[GamePlayer]) -> None:
    """Totals and ranks, the way the live game does them: score, then (speed scoring) the time of the
    right answers, then the name; in flat scoring equal scores share the place. Refuses a result that
    would leave anybody below zero."""
    flat = game.scoring == "flat"
    for p in players:
        p.score = _answers_sum(p) + p.adjustment
        if p.score < 0:
            raise ApiError(400, "SCORE_NEGATIVE")
        p.correct = sum(1 for a in p.answers if a["correct"])

    def key(p: GamePlayer) -> tuple[int, int, str, str]:
        time_ms = 0 if flat else sum(int(a["ms"]) for a in p.answers if a["correct"])
        return (-p.score, time_ms, p.nickname.casefold(), str(p.id))

    ordered = sorted(players, key=key)
    for p, rank in zip(ordered, places([p.score for p in ordered], shared=flat), strict=True):
        p.rank = rank


# --- the edits -----------------------------------------------------------------------------------


async def adjust_score(
    session: AsyncSession, admin: User, game_id: uuid.UUID, player_id: uuid.UUID, delta: int
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    before = player.score
    player.adjustment += delta
    _recompute(game, players)
    _log(game, admin, "adjust_score", player, delta=delta, before=before, after=player.score)
    await session.commit()
    return await detail(session, game_id)


async def set_score(
    session: AsyncSession, admin: User, game_id: uuid.UUID, player_id: uuid.UUID, score: int
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    before = player.score
    player.adjustment = score - _answers_sum(
        player
    )  # the answers keep their points; the gap is the adjustment
    _recompute(game, players)
    _log(game, admin, "set_score", player, before=before, after=player.score)
    await session.commit()
    return await detail(session, game_id)


async def edit_answer(
    session: AsyncSession,
    admin: User,
    game_id: uuid.UUID,
    player_id: uuid.UUID,
    question_id: str,
    change: AnswerEditIn,
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    answers = [dict(a) for a in player.answers]
    answer = next((a for a in answers if a["question"] == question_id), None)
    if answer is None:
        raise ApiError(404, "ANSWER_NOT_FOUND")  # nothing to change: the player did not answer it

    correct, points = change.correct, change.points
    if correct is None and points is None:
        raise ApiError(400, "NOTHING_TO_CHANGE")
    if correct is None:
        correct = points > 0  # type: ignore[operator]
    if points is None:
        base = 1 if game.scoring == "flat" else BASE_POINTS
        points = base if correct and not answer["points"] else (answer["points"] if correct else 0)
    if correct != (points > 0):
        raise ApiError(400, "ANSWER_INCONSISTENT")  # a wrong answer is worth 0, a right one 1-1000

    before = {"correct": answer["correct"], "points": answer["points"]}
    answer["correct"], answer["points"] = correct, points
    player.answers = answers
    _recompute(game, players)
    _log(
        game, admin, "edit_answer", player,
        question=question_id, before=before, after={"correct": correct, "points": points},
    )  # fmt: skip
    await session.commit()
    return await detail(session, game_id)


async def rename_player(
    session: AsyncSession, admin: User, game_id: uuid.UUID, player_id: uuid.UUID, nickname: str
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    try:
        clean = nicknames.validate(nickname)
    except nicknames.NicknameError as e:
        raise ApiError(400, e.code, "nickname") from None
    taken = {nicknames.skeleton(p.nickname) for p in players if p.id != player.id}
    if nicknames.skeleton(clean) in taken:
        raise ApiError(409, "NICKNAME_TAKEN", "nickname")
    before, player.nickname = player.nickname, clean
    _recompute(game, players)  # the name is the last tie-break
    _log(game, admin, "rename_player", player, before=before, after=clean)
    await session.commit()
    return await detail(session, game_id)


async def remove_player(
    session: AsyncSession, admin: User, game_id: uuid.UUID, player_id: uuid.UUID
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    _log(game, admin, "remove_player", player, score=player.score, rank=player.rank)
    await session.delete(player)
    await session.flush()
    _recompute(game, [p for p in players if p.id != player.id])
    await session.commit()
    return await detail(session, game_id)


async def clear_flag(
    session: AsyncSession, admin: User, game_id: uuid.UUID, player_id: uuid.UUID, kind: str
) -> GameDetail:
    game, players = await _load(session, game_id)
    player = _player(players, player_id)
    if kind not in FLAG_KINDS:
        raise ApiError(400, "VALIDATION_ERROR")
    kept = [f for f in player.flags if f["kind"] != kind]
    if len(kept) == len(player.flags):
        raise ApiError(404, "FLAG_NOT_FOUND")
    removed = next(f for f in player.flags if f["kind"] == kind)
    player.flags = kept
    _log(game, admin, "clear_flag", player, kind=kind, count=removed["count"])
    await session.commit()
    return await detail(session, game_id)


async def delete_game(session: AsyncSession, game_id: uuid.UUID) -> None:
    game, _ = await _load(session, game_id)
    await session.delete(game)  # its players go with it (ON DELETE CASCADE)
    await session.commit()


# --- reading -------------------------------------------------------------------------------------


async def detail(session: AsyncSession, game_id: uuid.UUID) -> GameDetail:
    game = await session.get(Game, game_id, populate_existing=True)
    if game is None:
        raise ApiError(404, "GAME_NOT_FOUND")
    owner = await session.get(User, game.owner_id)
    rows = (
        await session.execute(
            select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.rank)
        )
    ).scalars()
    players = [
        DetailPlayer(
            id=str(p.id),
            nickname=p.nickname,
            character=p.character,
            rank=p.rank,
            score=p.score,
            adjustment=p.adjustment,
            correct=p.correct,
            flags=p.flags,
            answers=[
                DetailAnswer(**{k: a[k] for k in ("question", "position", "ms", "points", "correct")})
                for a in p.answers
            ],
        )
        for p in rows
    ]
    return GameDetail(
        game_id=game.id,
        quiz_title=game.quiz_title,
        owner_name=owner.name if owner else "",
        finished_at=game.finished_at,
        duration_seconds=game.duration_seconds,
        questions=[
            DetailQuestion(id=q["id"], text=q["text"], answers=q["answers"], correct=q["correct"])
            for q in game.questions
        ],
        players=players,
        edits=[
            Edit.model_validate(
                {
                    "at": e["at"] / 1000,
                    "adminName": e["adminName"],
                    "action": e["action"],
                    "nickname": e["nickname"],
                    "detail": e["detail"],
                }
            )
            for e in game.audit
            if e.get("type") == "admin.edit"
        ],
    )
