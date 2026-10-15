import jwt

from app.config import get_settings
from app.db import SessionLocal
from app.security import create_token, decode_token
from app.services.auth import user_from_token
from tests.conftest import login_as, make_user
from tests.test_ws import room, server  # noqa: F401  (fixtures)


async def test_resetting_a_password_ends_that_users_open_sessions(client, as_user):
    admin, _ = await as_user("root", role="admin")
    ulan = await make_user("ulan", password="old-pass")
    await login_as(client, "ulan", "old-pass")
    assert (await client.get("/auth/me")).status_code == 200

    new = (await admin.post(f"/admin/users/{ulan.id}/reset-password")).json()["password"]
    r = await client.get("/auth/me")  # the cookie from before the reset
    assert (r.status_code, r.json()["code"]) == (401, "UNAUTHENTICATED")
    await login_as(client, "ulan", new)  # signing in again works and gives a working session
    assert (await client.get("/auth/me")).status_code == 200


async def test_resetting_one_user_leaves_other_sessions_alone(client, as_user):
    admin, _ = await as_user("root", role="admin")
    ulan = await make_user("ulan")
    other, _ = await as_user("omur")
    await admin.post(f"/admin/users/{ulan.id}/reset-password")
    assert (await other.get("/auth/me")).status_code == 200
    assert (await admin.get("/auth/me")).status_code == 200


async def test_token_claims_and_forgeries():
    token = create_token("abc", 3)
    assert decode_token(token) == ("abc", 3)
    secret = get_settings().jwt_secret
    assert decode_token(jwt.encode({"sub": "abc"}, secret, algorithm="HS256")) == ("abc", 0)  # an old token
    assert decode_token(jwt.encode({"sub": "abc", "ver": True}, secret, algorithm="HS256")) is None
    assert decode_token(jwt.encode({"sub": "abc", "ver": "1"}, secret, algorithm="HS256")) is None
    assert decode_token(jwt.encode({"sub": 5, "ver": 0}, secret, algorithm="HS256")) is None
    assert (
        decode_token(jwt.encode({"sub": "abc", "ver": 0}, "x" * 40, algorithm="HS256")) is None
    )  # wrong key
    assert decode_token(jwt.encode({"sub": "abc", "ver": 0}, None, algorithm="none")) is None  # unsigned
    assert decode_token("garbage") is None


async def test_user_from_token_checks_the_database_every_time():
    user = await make_user("aizhan")
    async with SessionLocal() as s:
        assert (await user_from_token(s, create_token(str(user.id), 0))).login == "aizhan"
        assert await user_from_token(s, create_token(str(user.id), 1)) is None  # a version that never existed
        assert await user_from_token(s, create_token(str(user.id), -1)) is None
        assert await user_from_token(s, create_token("not-a-uuid", 0)) is None
        assert await user_from_token(s, create_token("00000000-0000-0000-0000-000000000000", 0)) is None
        assert await user_from_token(s, None) is None
        assert await user_from_token(s, "") is None


async def test_the_host_socket_refuses_a_session_a_reset_has_ended(room, as_user):  # noqa: F811
    admin, _ = await as_user("root", role="admin")
    host_id = (await room.host_client.get("/auth/me")).json()["id"]
    ok = await room.host()  # the session works before the reset
    assert ok.events[0]["type"] == "host.state"
    await admin.post(f"/admin/users/{host_id}/reset-password")
    stale = await room.host()
    assert await stale.wait_closed() == 4401
