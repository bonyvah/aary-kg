from fastapi import FastAPI

from app.errors import register_error_handlers
from app.routers import admin_users, auth, contests, quizzes, users

app = FastAPI(title="aary kg", docs_url="/docs")
register_error_handlers(app)
app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(quizzes.router)
app.include_router(contests.router)
app.include_router(users.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
