import uuid

from fastapi import APIRouter, Response

from app.deps import AdminUser, CurrentUser, Session
from app.repositories import contests as repo
from app.schemas.contest import ContestIn, ContestOut, ResultsOut, ScoreIn
from app.services import contests as service

router = APIRouter(tags=["contests"])


async def _one(session: Session, user: CurrentUser, contest) -> ContestOut:  # type: ignore[no-untyped-def]
    return (await service.to_out(session, [contest], user))[0]


@router.get("/contests", response_model=list[ContestOut], response_model_by_alias=True)
async def my_contests(user: CurrentUser, session: Session) -> list[ContestOut]:
    """Contests the user owns or judges."""
    return await service.to_out(session, await repo.list_for_user(session, user.id), user)


@router.get("/admin/contests", response_model=list[ContestOut], response_model_by_alias=True)
async def all_contests(user: AdminUser, session: Session) -> list[ContestOut]:
    return await service.to_out(session, await repo.list_all(session), user)


@router.post("/contests", status_code=201, response_model=ContestOut, response_model_by_alias=True)
async def create_contest(body: ContestIn, user: CurrentUser, session: Session) -> ContestOut:
    return await _one(session, user, await service.create(session, user, body))


@router.get("/contests/{contest_id}", response_model=ContestOut, response_model_by_alias=True)
async def get_contest(contest_id: uuid.UUID, user: CurrentUser, session: Session) -> ContestOut:
    return await _one(session, user, await service.get_visible(session, user, contest_id))


@router.post("/contests/{contest_id}/open", response_model=ContestOut, response_model_by_alias=True)
async def open_contest(contest_id: uuid.UUID, user: CurrentUser, session: Session) -> ContestOut:
    return await _one(session, user, await service.open_contest(session, user, contest_id))


@router.post("/contests/{contest_id}/close", response_model=ContestOut, response_model_by_alias=True)
async def close_contest(contest_id: uuid.UUID, user: CurrentUser, session: Session) -> ContestOut:
    return await _one(session, user, await service.close_contest(session, user, contest_id))


@router.put("/contests/{contest_id}/scores", status_code=204)
async def set_score(contest_id: uuid.UUID, body: ScoreIn, user: CurrentUser, session: Session) -> Response:
    await service.set_score(session, user, contest_id, body.entry_id, body.criterion_id, body.score)
    return Response(status_code=204)


@router.post("/contests/{contest_id}/finish", response_model=ContestOut, response_model_by_alias=True)
async def finish(contest_id: uuid.UUID, user: CurrentUser, session: Session) -> ContestOut:
    return await _one(session, user, await service.finish(session, user, contest_id))


@router.get("/contests/{contest_id}/results", response_model=ResultsOut, response_model_by_alias=True)
async def results(contest_id: uuid.UUID, user: CurrentUser, session: Session) -> ResultsOut:
    return await service.results(session, user, contest_id)
