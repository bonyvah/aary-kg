import pytest

from app import main
from app.config import Settings

GOOD = {
    "jwt_secret": "k3Jx9qWm2Zp7LbV4nT8rY1uHc6Fd0SaE5gO",
    "env": "production",
    "cookie_secure": True,
    "allowed_origins": "https://quiz.example",
}


def settings(**over):
    return Settings(_env_file=None, **{**GOOD, **over})


# --- readiness ------------------------------------------------------------------------------


async def test_ready_when_postgres_and_redis_answer(client):
    r = await client.get("/health/ready")
    assert (r.status_code, r.json()) == (200, {"status": "ok", "postgres": True, "redis": True})


async def test_not_ready_when_redis_is_down(client, monkeypatch):
    class Broken:
        async def ping(self):
            raise ConnectionError("down")

    monkeypatch.setattr(main, "get_redis", lambda: Broken())
    r = await client.get("/health/ready")
    assert (r.status_code, r.json()) == (503, {"status": "unavailable", "postgres": True, "redis": False})
    assert (await client.get("/health")).status_code == 200  # still alive, just not ready


async def test_not_ready_when_postgres_is_down(client, monkeypatch):
    class Broken:
        def connect(self):
            raise ConnectionError("down")

    monkeypatch.setattr(main, "engine", Broken())
    r = await client.get("/health/ready")
    assert (r.status_code, r.json()) == (503, {"status": "unavailable", "postgres": False, "redis": True})


# --- production settings --------------------------------------------------------------------


def test_good_production_settings_start():
    settings().check_production()


def test_dev_settings_are_never_refused():
    settings(env="dev", cookie_secure=False, allowed_origins="").check_production()


@pytest.mark.parametrize(
    "over, mention",
    [
        ({"cookie_secure": False}, "COOKIE_SECURE"),
        ({"jwt_secret": "change-me-change-me-change-me-change-me"}, "placeholder"),
        ({"jwt_secret": "dev-secret-dev-secret-dev-secret-12345"}, "placeholder"),
        ({"jwt_secret": "a" * 40}, "variety"),
        ({"allowed_origins": ""}, "ALLOWED_ORIGINS"),
    ],
)
def test_unsafe_production_settings_are_refused_with_a_reason(over, mention):
    with pytest.raises(RuntimeError) as e:
        settings(**over).check_production()
    assert mention in str(e.value)


def test_every_problem_is_listed_at_once():
    with pytest.raises(RuntimeError) as e:
        settings(cookie_secure=False, allowed_origins="", jwt_secret="a" * 40).check_production()
    assert str(e.value).count("\n- ") == 3


async def test_the_app_will_not_start_with_unsafe_production_settings(monkeypatch):
    monkeypatch.setattr(main, "get_settings", lambda: settings(cookie_secure=False))
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        async with main.lifespan(main.app):
            pass


def test_short_secrets_are_refused_by_every_environment():
    with pytest.raises(ValueError):
        Settings(_env_file=None, jwt_secret="short")


def test_allowed_origins_are_normalised():
    s = settings(allowed_origins=" https://A.example/ , http://localhost:3000,,")
    assert s.allowed_origin_list == ["https://a.example", "http://localhost:3000"]
