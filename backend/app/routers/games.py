import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request

from app.deps import AdminUser, CurrentUser, Session
from app.errors import ApiError
from app.game import ratelimit
from app.game.models import GameError
from app.game.runtime import get_engine
from app.netutil import client_ip
from app.redis import get_redis
from app.schemas.game import (
    CreateGameIn,
    CreateGameOut,
    GameReport,
    GameSummary,
    HostTicketOut,
    JoinedPlayer,
    JoinIn,
    JoinOut,
)
from app.security import create_player_token
from app.services import auth as auth_service
from app.services import games as service
from app.services import quizzes as quizzes_service

router = APIRouter(prefix="/games", tags=["games"])
admin_router = APIRouter(tags=["admin"])


# A whole classroom often shares ONE public address (the school's Wi-Fi), so a plain per-address
# limit on joining would lock out the people the game is for. What an attacker does is guess PINs,
# and that means many FAILED lookups: those are limited tightly, successful joins generously.
FAILED_PIN_LIMIT, FAILED_PIN_WINDOW_S = 20, 60
PIN_CHECK_LIMIT = 600  # per minute and address, successful or not
JOIN_LIMIT = 300
# Failures that mean "this PIN is a guess". A refused nickname, or a game that already started,
# proves the PIN was right and is not counted.
GUESS_CODES = ("PIN_INVALID", "GAME_NOT_FOUND")


async def _limit(request: Request, what: str, limit: int, window_s: int) -> None:
    if not await ratelimit.allow(get_redis(), f"rl:{what}:{client_ip(request)}", limit, window_s):
        raise ApiError(429, "RATE_LIMITED")


async def _guard_pin_guessing[T](request: Request, attempt: Callable[[], Awaitable[T]]) -> T:
    """Refuses an address that has already failed too many PIN lookups, and counts a new failure."""
    key = f"rl:pinfail:{client_ip(request)}"
    if int(await get_redis().get(key) or 0) >= FAILED_PIN_LIMIT:
        raise ApiError(429, "RATE_LIMITED")
    try:
        return await attempt()
    except GameError as e:
        if e.code in GUESS_CODES:
            await ratelimit.allow(get_redis(), key, FAILED_PIN_LIMIT, FAILED_PIN_WINDOW_S)
        raise


@router.post("", status_code=201, response_model=CreateGameOut, response_model_by_alias=True)
async def create_game(body: CreateGameIn, user: CurrentUser, session: Session) -> CreateGameOut:
    """The host starts a lobby for one of their quizzes. The quiz is copied: later edits don't touch it."""
    if user.role == "admin":
        raise ApiError(403, "FORBIDDEN")  # admins don't host games, they manage the data of finished ones
    quiz = await quizzes_service.get_editable(session, user, body.quiz_id)
    snapshot = {"id": str(quiz.id), "title": quiz.title, "questions": quiz.questions}
    state = await get_engine().create_game(str(user.id), snapshot)
    return CreateGameOut(game_id=state.id, pin=state.pin)


@router.post("/{game_id}/host-ticket", response_model=HostTicketOut, response_model_by_alias=True)
async def host_ticket(game_id: str, user: CurrentUser) -> HostTicketOut:
    """A one-minute ticket the host screen sends as the first message on its socket."""
    state = await get_engine().repo.get_game(game_id) if len(game_id) <= 64 else None
    owner = state.owner_id if state else None
    return HostTicketOut(ticket=auth_service.host_ticket(user, owner, game_id))


@router.get("/pin/{pin}", status_code=204)
async def check_pin(pin: str, request: Request) -> None:
    """Is there a lobby with this PIN that can still be joined? Rate limited: PINs are only 6 digits."""
    await _limit(request, "pin", PIN_CHECK_LIMIT, 60)
    await _guard_pin_guessing(request, lambda: get_engine().joinable(pin))


@router.post("/join", response_model=JoinOut, response_model_by_alias=True)
async def join(body: JoinIn, request: Request) -> JoinOut:
    await _limit(request, "join", JOIN_LIMIT, 60)
    state, player = await _guard_pin_guessing(request, lambda: get_engine().join(body.pin, body.nickname))
    return JoinOut(
        token=create_player_token(state.id, player.id),
        player=JoinedPlayer(id=player.id, nickname=player.nickname, character=player.character),
    )


@admin_router.get("/admin/games", response_model=list[GameSummary], response_model_by_alias=True)
async def all_games(_: AdminUser, session: Session) -> list[GameSummary]:
    return await service.list_all_games(session)


@router.get("", response_model=list[GameSummary], response_model_by_alias=True)
async def my_games(user: CurrentUser, session: Session) -> list[GameSummary]:
    return await service.list_games(session, user)


@router.get("/{game_id}/report", response_model=GameReport, response_model_by_alias=True)
async def game_report(game_id: uuid.UUID, user: CurrentUser, session: Session) -> GameReport:
    return await service.report(session, user, game_id)
