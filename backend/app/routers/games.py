import uuid

from fastapi import APIRouter, Request

from app.deps import CurrentUser, Session
from app.errors import ApiError
from app.game import ratelimit
from app.game.runtime import get_engine
from app.redis import get_redis
from app.schemas.game import (
    CreateGameIn,
    CreateGameOut,
    GameReport,
    GameSummary,
    JoinedPlayer,
    JoinIn,
    JoinOut,
)
from app.security import create_player_token
from app.services import games as service
from app.services import quizzes as quizzes_service

router = APIRouter(prefix="/games", tags=["games"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _limit(request: Request, what: str, limit: int, window_s: int) -> None:
    if not await ratelimit.allow(get_redis(), f"rl:{what}:{client_ip(request)}", limit, window_s):
        raise ApiError(429, "RATE_LIMITED")


@router.post("", status_code=201, response_model=CreateGameOut, response_model_by_alias=True)
async def create_game(body: CreateGameIn, user: CurrentUser, session: Session) -> CreateGameOut:
    """The host starts a lobby for one of their quizzes. The quiz is copied: later edits don't touch it."""
    quiz = await quizzes_service.get_editable(session, user, body.quiz_id)
    snapshot = {"id": str(quiz.id), "title": quiz.title, "questions": quiz.questions}
    state = await get_engine().create_game(str(user.id), snapshot, body.shuffle_questions)
    return CreateGameOut(game_id=state.id, pin=state.pin)


@router.get("/pin/{pin}", status_code=204)
async def check_pin(pin: str, request: Request) -> None:
    """Is there a lobby with this PIN that can still be joined? Rate limited: PINs are only 6 digits."""
    await _limit(request, "pin", 60, 60)
    await get_engine().joinable(pin)


@router.post("/join", response_model=JoinOut, response_model_by_alias=True)
async def join(body: JoinIn, request: Request) -> JoinOut:
    await _limit(request, "join", 30, 60)
    state, player = await get_engine().join(body.pin, body.nickname)
    return JoinOut(
        token=create_player_token(state.id, player.id),
        player=JoinedPlayer(id=player.id, nickname=player.nickname, character=player.character),
    )


@router.get("", response_model=list[GameSummary], response_model_by_alias=True)
async def my_games(user: CurrentUser, session: Session) -> list[GameSummary]:
    return await service.list_games(session, user)


@router.get("/{game_id}/report", response_model=GameReport, response_model_by_alias=True)
async def game_report(game_id: uuid.UUID, user: CurrentUser, session: Session) -> GameReport:
    return await service.report(session, user, game_id)
