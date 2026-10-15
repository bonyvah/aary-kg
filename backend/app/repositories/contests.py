import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contest import Contest, ContestJury, ContestScore


async def get(
    session: AsyncSession, contest_id: uuid.UUID, *, lock: bool = False, fresh: bool = False
) -> Contest | None:
    """lock=True holds the row until commit, so scoring can't race with close.
    fresh=True re-reads the row and its jury even if the session already holds them."""
    stmt = select(Contest).where(Contest.id == contest_id)
    if fresh:
        stmt = stmt.execution_options(populate_existing=True)
    if lock:
        # Lock the contest row only; jury and owner are joined/selectin loaded.
        stmt = stmt.with_for_update(of=Contest)
    return (await session.execute(stmt)).unique().scalar_one_or_none()


async def list_for_user(session: AsyncSession, user_id: uuid.UUID) -> list[Contest]:
    in_jury = select(ContestJury.contest_id).where(ContestJury.user_id == user_id)
    stmt = (
        select(Contest)
        .where((Contest.owner_id == user_id) | (Contest.id.in_(in_jury)))
        .order_by(Contest.created_at.desc())
    )
    return list((await session.execute(stmt)).unique().scalars())


async def list_all(session: AsyncSession) -> list[Contest]:
    stmt = select(Contest).order_by(Contest.created_at.desc())
    return list((await session.execute(stmt)).unique().scalars())


async def scores_of(
    session: AsyncSession, contest_ids: list[uuid.UUID], user_id: uuid.UUID | None = None
) -> list[ContestScore]:
    stmt = select(ContestScore).where(ContestScore.contest_id.in_(contest_ids))
    if user_id is not None:
        stmt = stmt.where(ContestScore.user_id == user_id)
    return list((await session.execute(stmt)).scalars())


async def upsert_score(
    session: AsyncSession,
    contest_id: uuid.UUID,
    user_id: uuid.UUID,
    entry_id: str,
    criterion_id: str,
    score: int,
) -> None:
    stmt = insert(ContestScore).values(
        contest_id=contest_id,
        user_id=user_id,
        entry_id=entry_id,
        criterion_id=criterion_id,
        score=score,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["contest_id", "user_id", "entry_id", "criterion_id"],
        set_={"score": score},
    )
    await session.execute(stmt)
