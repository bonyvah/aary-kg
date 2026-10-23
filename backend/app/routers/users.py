from fastapi import APIRouter

from app.deps import Session, StaffUser
from app.repositories import users as repo
from app.schemas.contest import DirectoryUser
from app.schemas.exam_session import StudentOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/directory", response_model=list[DirectoryUser], response_model_by_alias=True)
async def directory(_: StaffUser, session: Session) -> list[DirectoryUser]:
    """Active teachers with name and login: who can be picked as jury. No roles, no passwords."""
    teachers = await repo.list_active_teachers(session)
    return [DirectoryUser(id=u.id, name=u.name, login=u.login) for u in teachers]


@router.get("/students", response_model=list[StudentOut], response_model_by_alias=True)
async def students(_: StaffUser, session: Session) -> list[StudentOut]:
    """Active students with their group: who can be given an exam. No logins, no passwords."""
    rows = await repo.list_active_students(session)
    return [StudentOut(id=u.id, name=u.name, group_id=u.group_id, group_name=u.group_name) for u in rows]
