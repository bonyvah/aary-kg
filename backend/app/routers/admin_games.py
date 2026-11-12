import uuid

from fastapi import APIRouter, Response

from app.deps import OverseerUser, Session, SuperAdminUser
from app.schemas.game_admin import AdjustIn, AnswerEditIn, GameDetail, RenameIn, SetScoreIn
from app.services import game_admin as service

router = APIRouter(prefix="/admin/games", tags=["admin"])
model = {"response_model": GameDetail, "response_model_by_alias": True}


@router.get("/{game_id}", **model)
async def get_game(game_id: uuid.UUID, _: OverseerUser, session: Session) -> GameDetail:
    """The whole finished game, with every answer: the superadmin may correct it, an admin only reads it."""
    return await service.detail(session, game_id)


@router.post("/{game_id}/players/{player_id}/adjust", **model)
async def adjust(
    game_id: uuid.UUID, player_id: uuid.UUID, body: AdjustIn, admin: SuperAdminUser, session: Session
) -> GameDetail:
    return await service.adjust_score(session, admin, game_id, player_id, body.delta)


@router.put("/{game_id}/players/{player_id}/score", **model)
async def set_score(
    game_id: uuid.UUID, player_id: uuid.UUID, body: SetScoreIn, admin: SuperAdminUser, session: Session
) -> GameDetail:
    return await service.set_score(session, admin, game_id, player_id, body.score)


@router.patch("/{game_id}/players/{player_id}/answers/{question_id}", **model)
async def edit_answer(
    game_id: uuid.UUID,
    player_id: uuid.UUID,
    question_id: str,
    body: AnswerEditIn,
    admin: SuperAdminUser,
    session: Session,
) -> GameDetail:
    return await service.edit_answer(session, admin, game_id, player_id, question_id, body)


@router.patch("/{game_id}/players/{player_id}", **model)
async def rename(
    game_id: uuid.UUID, player_id: uuid.UUID, body: RenameIn, admin: SuperAdminUser, session: Session
) -> GameDetail:
    return await service.rename_player(session, admin, game_id, player_id, body.nickname)


@router.delete("/{game_id}/players/{player_id}", **model)
async def remove_player(
    game_id: uuid.UUID, player_id: uuid.UUID, admin: SuperAdminUser, session: Session
) -> GameDetail:
    return await service.remove_player(session, admin, game_id, player_id)


@router.delete("/{game_id}/players/{player_id}/flags/{kind}", **model)
async def clear_flag(
    game_id: uuid.UUID, player_id: uuid.UUID, kind: str, admin: SuperAdminUser, session: Session
) -> GameDetail:
    return await service.clear_flag(session, admin, game_id, player_id, kind)


@router.delete("/{game_id}", status_code=204)
async def delete_game(game_id: uuid.UUID, _: SuperAdminUser, session: Session) -> Response:
    await service.delete_game(session, game_id)
    return Response(status_code=204)
