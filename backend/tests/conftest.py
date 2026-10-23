import os

# Must be set before app modules import settings.
os.environ["AARY_JWT_SECRET"] = "test-secret-test-secret-test-secret-123"
# The tests empty their databases before and after every test, so they must never inherit the
# AARY_DATABASE_URL / AARY_REDIS_URL of a dev shell: they take their own, or the defaults below.
os.environ["AARY_DATABASE_URL"] = os.environ.get(
    "AARY_TEST_DATABASE_URL", "postgresql+asyncpg://postgres@localhost:5432/aary_test"
)
# Redis database 15 is the tests' own.
os.environ["AARY_REDIS_URL"] = os.environ.get("AARY_TEST_REDIS_URL", "redis://localhost:6379/15")

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.security import hash_password  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated() -> None:
    """Build the test DB with the real migrations."""
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
async def clean_db(migrated: None):
    yield
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE users, groups, quizzes, exams, exam_sessions, contests, games CASCADE")
        )


@pytest.fixture(autouse=True)
def no_reading_time(monkeypatch):
    """Questions open for answers at once, as before reading times existed: otherwise every test that
    plays a question waits 3 s for it. The reading-time tests set their own short second."""
    from app.game import engine

    monkeypatch.setattr(engine, "READ_MS_PER_SECOND", 0)


@pytest.fixture(autouse=True)
async def clean_redis():
    from app.redis import get_redis

    await get_redis().flushdb()
    yield


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_user(login: str, role: str = "teacher", password: str = "pw-12345", active=True):
    async with SessionLocal() as s:
        user = User(
            first_name=login.title(),
            last_name="",
            login=login,
            role=role,
            active=active,
            password_hash=hash_password(password),
        )
        s.add(user)
        await s.commit()
        return user


async def login_as(client: AsyncClient, login: str, password: str = "pw-12345") -> None:
    r = await client.post("/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text


@pytest.fixture
async def as_user():
    """as_user("ulan", role="admin") -> (client logged in as that user, user). Separate cookie jars."""
    clients: list[AsyncClient] = []

    async def make(login: str, role: str = "teacher"):
        user = await make_user(login, role=role)
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        await login_as(c, login)
        return c, user

    yield make
    for c in clients:
        await c.aclose()
