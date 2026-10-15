from fastapi import FastAPI

from app.errors import register_error_handlers
from app.middleware import BodyLimitMiddleware, SecurityHeadersMiddleware
from app.routers import admin_users, auth, contests, games, quizzes, users, ws

app = FastAPI(title="aary kg", docs_url="/docs")
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
register_error_handlers(app)
app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(quizzes.router)
app.include_router(contests.router)
app.include_router(users.router)
app.include_router(games.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict[str, str]:
    """The process is up. Cheap, for a liveness probe."""
    return {"status": "ok"}
