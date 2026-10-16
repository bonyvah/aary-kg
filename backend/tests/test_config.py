from app.config import Settings

SECRET = "x" * 32


def url(raw: str) -> str:
    return Settings(jwt_secret=SECRET, database_url=raw).database_url


def test_a_neon_url_becomes_an_asyncpg_url():
    assert (
        url("postgresql://u:p@ep-1-pooler.neon.tech/aary?sslmode=require&channel_binding=require")
        == "postgresql+asyncpg://u:p@ep-1-pooler.neon.tech/aary?ssl=require"
    )
    assert url("postgres://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"


def test_an_asyncpg_url_is_left_alone():
    raw = "postgresql+asyncpg://postgres:postgres@localhost:5432/aary"
    assert url(raw) == raw
