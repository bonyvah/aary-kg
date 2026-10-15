from fastapi import APIRouter

from app.deps import CurrentUser, Session
from app.repositories import users as repo
from app.schemas.contest import DirectoryUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/directory", response_model=list[DirectoryUser], response_model_by_alias=True)
async def directory(_: CurrentUser, session: Session) -> list[DirectoryUser]:
    """Active users, name only: who can be picked as jury. No logins, no roles."""
    return [DirectoryUser(id=u.id, name=u.name) for u in await repo.list_active(session)]
