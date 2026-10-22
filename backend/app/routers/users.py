from fastapi import APIRouter

from app.deps import Session, StaffUser
from app.repositories import users as repo
from app.schemas.contest import DirectoryUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/directory", response_model=list[DirectoryUser], response_model_by_alias=True)
async def directory(_: StaffUser, session: Session) -> list[DirectoryUser]:
    """Active users with name and login: who can be picked as jury. No roles, no passwords."""
    return [DirectoryUser(id=u.id, name=u.name, login=u.login) for u in await repo.list_active(session)]
