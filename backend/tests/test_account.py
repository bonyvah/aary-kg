from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import login_as, make_user

OLD = "pw-12345"


async def fresh(login: str, password: str) -> AsyncClient:
    c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await login_as(c, login, password)
    return c


async def change_password(c, new: str, current: str = OLD):
    return await c.put("/auth/me/password", json={"currentPassword": current, "newPassword": new})


async def change_login(c, login: str, current: str = OLD):
    return await c.put("/auth/me/login", json={"currentPassword": current, "login": login})


async def test_both_need_a_session(client):
    assert (await change_password(client, "abcd1234")).status_code == 401
    assert (await change_login(client, "newlogin")).status_code == 401


async def test_change_password_works_and_ends_other_sessions(as_user):
    c, _ = await as_user("ulan")
    other = await fresh("ulan", OLD)
    r = await change_password(c, "tulpar-9421")
    assert r.status_code == 200 and r.json()["login"] == "ulan"
    assert (await c.get("/auth/me")).status_code == 200  # this session carries on
    assert (await other.get("/auth/me")).status_code == 401  # every other one ended
    bad = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    assert (await bad.post("/auth/login", json={"login": "ulan", "password": OLD})).status_code == 401
    await login_as(bad, "ulan", "tulpar-9421")
    await bad.aclose()
    await other.aclose()


async def test_the_current_password_is_checked(as_user):
    c, _ = await as_user("ulan")
    r = await change_password(c, "tulpar-9421", current="wrong-pass-1")
    assert (r.status_code, r.json()) == (400, {"code": "CURRENT_PASSWORD_WRONG", "field": "currentPassword"})
    r = await change_login(c, "newlogin", current="wrong-pass-1")
    assert (r.status_code, r.json()["code"]) == (400, "CURRENT_PASSWORD_WRONG")


async def test_guessing_the_current_password_is_limited(as_user):
    c, _ = await as_user("ulan")
    for _ in range(8):
        await change_password(c, "tulpar-9421", current="wrong-pass-1")
    r = await change_password(c, "tulpar-9421")  # even the right one now
    assert (r.status_code, r.json()["code"]) == (429, "RATE_LIMITED")


async def test_the_policy_applies(as_user):
    c, _ = await as_user("ulan")
    for password, code in [
        ("abc12", "PASSWORD_TOO_SHORT"),
        ("12345678", "PASSWORD_NEEDS_LETTER"),
        ("abcdefgh", "PASSWORD_NEEDS_DIGIT"),
        ("my-ulan-pass1", "PASSWORD_CONTAINS_NAME"),
        (OLD, "PASSWORD_SAME"),
    ]:
        r = await change_password(c, password)
        assert (r.status_code, r.json()) == (400, {"code": code, "field": "newPassword"}), password


async def test_the_name_in_another_alphabet_is_refused(as_user):
    from app.db import SessionLocal
    from app.repositories import users as repo

    c, user = await as_user("zzz-login")
    async with SessionLocal() as s:
        u = await repo.get(s, user.id)
        u.first_name, u.last_name = "Өмүр", "Асанова"
        await s.commit()
    for password in ["Omur12345", "ömür-12345", "ОМҮР12345", "asanova-1", "Asanova1"]:
        r = await change_password(c, password)
        assert (r.status_code, r.json()["code"]) == (400, "PASSWORD_CONTAINS_NAME"), password
    assert (await change_password(c, "tulpar-9421")).status_code == 200


async def test_failed_attempts_change_nothing(as_user):
    c, _ = await as_user("ulan")
    await change_password(c, "abc12")
    await login_as(await fresh("ulan", OLD), "ulan", OLD)  # old password still works


async def test_change_login(as_user):
    c, _ = await as_user("ulan")
    other = await fresh("ulan", OLD)
    r = await change_login(c, " New.Ulan ")
    assert r.status_code == 200 and r.json()["login"] == "new.ulan"
    assert (await other.get("/auth/me")).status_code == 200  # a login change does not end sessions
    probe = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    assert (await probe.post("/auth/login", json={"login": "ulan", "password": OLD})).status_code == 401
    await login_as(probe, "new.ulan", OLD)
    await probe.aclose()
    await other.aclose()


async def test_change_login_rules(as_user):
    c, _ = await as_user("ulan")
    await make_user("taken")
    for login, status, code in [
        ("", 400, "FIELD_REQUIRED"),
        ("ab", 400, "LOGIN_INVALID"),
        ("bad login", 400, "LOGIN_INVALID"),
        ("Ulan", 400, "NOTHING_TO_CHANGE"),
        ("TAKEN", 409, "LOGIN_TAKEN"),
    ]:
        r = await change_login(c, login)
        assert (r.status_code, r.json()["code"]) == (status, code), login


async def test_an_admin_can_change_their_own_too(as_user):
    c, _ = await as_user("boss", role="admin")
    assert (await change_login(c, "boss2")).status_code == 200
    assert (await change_password(c, "tulpar-9421")).status_code == 200
    assert (await c.get("/admin/users")).status_code == 200


async def test_users_are_shown_as_first_then_last_name(as_user):
    c, user = await as_user("ulan")
    me = (await c.get("/auth/me")).json()
    assert (me["firstName"], me["lastName"], me["name"]) == ("Ulan", "", "Ulan")
