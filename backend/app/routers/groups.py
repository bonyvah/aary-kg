import uuid

from fastapi import APIRouter, Response

from app.deps import AdminUser, Session, StaffUser
from app.schemas.group import GroupIn, GroupOut
from app.services import groups as service

router = APIRouter(tags=["groups"])


@router.get("/admin/groups", response_model=list[GroupOut], response_model_by_alias=True)
async def admin_list(_: AdminUser, session: Session) -> list[GroupOut]:
    return await service.list_all(session)


@router.post("/admin/groups", status_code=201, response_model=GroupOut, response_model_by_alias=True)
async def create(body: GroupIn, _: AdminUser, session: Session) -> GroupOut:
    return await service.create(session, body.name)


@router.put("/admin/groups/{group_id}", response_model=GroupOut, response_model_by_alias=True)
async def rename(group_id: uuid.UUID, body: GroupIn, _: AdminUser, session: Session) -> GroupOut:
    return await service.rename(session, group_id, body.name)


@router.delete("/admin/groups/{group_id}", status_code=204)
async def delete(group_id: uuid.UUID, _: AdminUser, session: Session) -> Response:
    await service.delete(session, group_id)
    return Response(status_code=204)


@router.get("/groups", response_model=list[GroupOut], response_model_by_alias=True)
async def staff_list(_: StaffUser, session: Session) -> list[GroupOut]:
    """Teachers see the groups (to give them an exam) but don't change them."""
    return await service.list_all(session)
