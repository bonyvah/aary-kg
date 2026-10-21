import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.errors import ApiError
from app.game import anticheat
from app.game.models import FinishedGame
from app.models.game import Game, GamePlayer
from app.models.user import User
from app.schemas.game import GameReport, GameSummary


def _at(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC)


async def persist_finished(finished: FinishedGame) -> None:
    """Writes a finished game to Postgres: the game, its players with their answers and flags."""
    state, quiz = finished.game, finished.quiz
    played = [quiz["questions"][i] for i in state.order[: state.round + 1]]
    flags = anticheat.flags_from_signals(finished.signals)
    rank = {s["id"]: s["rank"] for s in finished.standings}

    game = Game(
        id=uuid.UUID(state.id),
        owner_id=uuid.UUID(state.owner_id),
        quiz_id=uuid.UUID(state.quiz_id),
        quiz_title=quiz["title"],
        questions=played,
        started_at=_at(state.started_ms),
        finished_at=_at(state.finished_ms),
        duration_seconds=max(0, (state.finished_ms - state.started_ms) // 1000),
        scoring=state.scoring,
        audit=finished.audit,
    )
    players = []
    for p in finished.players:
        answers = [
            {"round": rnd, "question": played[rnd]["id"], **per_player[p.id]}
            for rnd, per_player in sorted(finished.results.items())
            if p.id in per_player
        ]
        players.append(
            GamePlayer(
                id=uuid.UUID(p.id),
                game_id=game.id,
                nickname=p.nickname,
                character=p.character,
                score=p.score,
                rank=rank[p.id],
                correct=p.correct,
                flags=flags.get(p.id, []),
                answers=answers,
            )
        )
    async with SessionLocal() as session:
        # A ruling on the podium saves the game again: the new copy replaces the one before it.
        await session.execute(delete(Game).where(Game.id == game.id))
        session.add(game)
        await session.flush()
        session.add_all(players)
        await session.commit()


def _visible(game: Game, user: User) -> bool:
    return user.role == "admin" or game.owner_id == user.id


async def _summaries(session: AsyncSession, owner_id: uuid.UUID | None) -> list[GameSummary]:
    counts = select(GamePlayer.game_id, func.count().label("n")).group_by(GamePlayer.game_id).subquery()
    stmt = (
        select(Game, func.coalesce(counts.c.n, 0), User.name)
        .outerjoin(counts, counts.c.game_id == Game.id)
        .join(User, User.id == Game.owner_id)
        .order_by(Game.finished_at.desc())
    )
    if owner_id is not None:
        stmt = stmt.where(Game.owner_id == owner_id)
    return [
        GameSummary(
            id=g.id,
            quiz_title=g.quiz_title,
            owner_name=owner_name,
            finished_at=g.finished_at,
            player_count=n,
            question_count=len(g.questions),
        )
        for g, n, owner_name in (await session.execute(stmt)).all()
    ]


async def list_games(session: AsyncSession, user: User) -> list[GameSummary]:
    """The games this user hosted, newest first."""
    return await _summaries(session, user.id)


async def list_all_games(session: AsyncSession) -> list[GameSummary]:
    """Every finished game of everybody, newest first. For admins."""
    return await _summaries(session, None)


async def report(session: AsyncSession, user: User, game_id: uuid.UUID) -> GameReport:
    game = await session.get(Game, game_id)
    if game is None or not _visible(game, user):
        raise ApiError(404, "GAME_NOT_FOUND")
    rows = (
        (
            await session.execute(
                select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.rank)
            )
        )
        .scalars()
        .all()
    )
    total = len(rows)
    questions = [
        {
            "id": q["id"],
            "text": q["text"],
            "answers": q["answers"],
            "correct": q["correct"],
            "correctShare": (
                sum(1 for r in rows for a in r.answers if a["question"] == q["id"] and a["correct"]) / total
                if total
                else 0
            ),
        }
        for q in game.questions
    ]
    return GameReport.model_validate(
        {
            "gameId": game.id,
            "quizId": game.quiz_id,
            "quizTitle": game.quiz_title,
            "finishedAt": game.finished_at,
            "durationSeconds": game.duration_seconds,
            "questionCount": len(game.questions),
            "editCount": sum(1 for e in game.audit if e.get("type") == "admin.edit"),
            "players": [
                {
                    "id": str(r.id),
                    "nickname": r.nickname,
                    "character": r.character,
                    "rank": r.rank,
                    "score": r.score,
                    "correct": r.correct,
                    "flags": r.flags,
                    "answers": [
                        {k: a[k] for k in ("question", "position", "ms", "points", "correct")}
                        for a in r.answers
                    ],
                }
                for r in rows
            ],
            "questions": questions,
        }
    )
