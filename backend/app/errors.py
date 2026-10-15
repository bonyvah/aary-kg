from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.game.models import GameError


class ApiError(Exception):
    """Stable error code for the frontend to translate. Never human text."""

    def __init__(
        self,
        status: int,
        code: str,
        field: str | None = None,
        issues: list[dict[str, str]] | None = None,
    ) -> None:
        self.status = status
        self.code = code
        self.field = field
        # A failed save lists everything that is wrong: [{code, field}].
        self.issues = issues


# HTTP status of the game's error codes. Anything not listed is a plain 400.
GAME_STATUS = {
    "GAME_NOT_FOUND": 404,
    "UNKNOWN_PLAYER": 404,
    "GAME_STARTED": 409,
    "NICKNAME_TAKEN": 409,
    "GAME_FULL": 409,
    "INVALID_STATE": 409,
    "NO_PLAYERS": 409,
    "BUSY": 503,
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(GameError)
    async def _game_error(_: Request, exc: GameError) -> JSONResponse:
        status = GAME_STATUS.get(exc.code, 400)
        return JSONResponse({"code": exc.code, "field": None}, status_code=status)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        body: dict[str, object] = {"code": exc.code, "field": exc.field}
        if exc.issues is not None:
            body["issues"] = exc.issues
        return JSONResponse(body, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse({"code": "VALIDATION_ERROR", "field": None}, status_code=422)
