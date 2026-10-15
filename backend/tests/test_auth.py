from tests.conftest import login_as, make_user


async def test_login_required_fields(client):
    r = await client.post("/auth/login", json={"login": " ", "password": ""})
    assert (r.status_code, r.json()["code"]) == (400, "CREDENTIALS_REQUIRED")


async def test_login_wrong_password_and_unknown_user_look_the_same(client):
    await make_user("aizhan")
    a = await client.post("/auth/login", json={"login": "aizhan", "password": "nope"})
    b = await client.post("/auth/login", json={"login": "ghost", "password": "nope"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"code": "INVALID_CREDENTIALS", "field": None}


async def test_disabled_user_cannot_login(client):
    await make_user("ulan", active=False)
    r = await client.post("/auth/login", json={"login": "ulan", "password": "pw-12345"})
    assert r.json()["code"] == "INVALID_CREDENTIALS"


async def test_login_sets_httponly_cookie_and_me_works(client):
    await make_user("aizhan", role="admin")
    r = await client.post("/auth/login", json={"login": "Aizhan", "password": "pw-12345"})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    assert r.json()["role"] == "admin" and "passwordHash" not in r.json()
    me = await client.get("/auth/me")
    assert me.json()["login"] == "aizhan" and "createdAt" in me.json()


async def test_me_without_cookie_is_401(client):
    r = await client.get("/auth/me")
    assert (r.status_code, r.json()["code"]) == (401, "UNAUTHENTICATED")


async def test_logout_clears_session(client):
    await make_user("aizhan")
    await login_as(client, "aizhan")
    await client.post("/auth/logout")
    assert (await client.get("/auth/me")).status_code == 401


async def test_disabling_takes_effect_on_existing_token(client):
    await make_user("root", role="admin")
    u = await make_user("ulan")
    await login_as(client, "ulan")
    assert (await client.get("/auth/me")).status_code == 200
    admin = type(client)(transport=client._transport, base_url="http://test")
    await login_as(admin, "root")
    assert (await admin.post(f"/admin/users/{u.id}/disable")).status_code == 200
    assert (await client.get("/auth/me")).status_code == 401
    await admin.aclose()
