from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        body: dict[str, object] = {"code": exc.code, "field": exc.field}
        if exc.issues is not None:
            body["issues"] = exc.issues
        return JSONResponse(body, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse({"code": "VALIDATION_ERROR", "field": None}, status_code=422)
