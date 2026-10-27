from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.errors import register_error_handlers
from app.middleware import BodyLimitMiddleware, SecurityHeadersMiddleware
from app.redis import get_redis
from app.routers import (
    admin_games,
    admin_users,
    auth,
    contests,
    exam_sessions,
    exams,
    games,
    groups,
    quizzes,
    student_exams,
    users,
    ws,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings().check_production()  # unsafe production settings stop the app here
    yield
    await get_redis().aclose()
    await engine.dispose()


app = FastAPI(title="aary kg", docs_url="/docs", lifespan=lifespan)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
register_error_handlers(app)
app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(admin_games.router)
app.include_router(groups.router)
app.include_router(quizzes.router)
app.include_router(exams.router)
app.include_router(exam_sessions.router)
app.include_router(exam_sessions.admin_router)
app.include_router(exam_sessions.attempts_admin_router)
app.include_router(student_exams.router)
app.include_router(contests.router)
app.include_router(users.router)
app.include_router(games.router)
app.include_router(games.admin_router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict[str, str]:
    """The process is up. Cheap, for a liveness probe."""
    return {"status": "ok"}


@app.get("/health/ready")
async def ready() -> JSONResponse:
    """Can it do its job: Postgres and Redis both answer. 503 if either does not."""
    checks = {"postgres": False, "redis": False}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = True
    except Exception:
        pass
    try:
        checks["redis"] = bool(await get_redis().ping())
    except Exception:
        pass
    healthy = all(checks.values())
    return JSONResponse(
        {"status": "ok" if healthy else "unavailable", **checks}, status_code=200 if healthy else 503
    )
