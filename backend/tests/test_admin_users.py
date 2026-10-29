from tests.conftest import login_as, make_user


async def admin_client(client):
    admin = await make_user("root", role="admin")
    await login_as(client, "root")
    return admin


async def test_requires_login_and_admin(client):
    assert (await client.get("/admin/users")).status_code == 401
    await make_user("ulan")
    await login_as(client, "ulan")
    r = await client.get("/admin/users")
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")


async def test_create_user_returns_password_once_and_it_works(client):
    await admin_client(client)
    r = await client.post(
        "/admin/users",
        json={"firstName": " Ulan ", "lastName": " Kasymov ", "login": " Ulan.K ", "role": "teacher"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["login"] == "ulan.k" and body["user"]["name"] == "Ulan Kasymov"
    assert (body["user"]["firstName"], body["user"]["lastName"]) == ("Ulan", "Kasymov")
    assert body["user"]["active"] is True and len(body["user"]["createdAt"]) == 10
    listing = (await client.get("/admin/users")).text
    assert body["password"] not in listing and "password" not in listing.lower()
    fresh = type(client)(transport=client._transport, base_url="http://test")
    await login_as(fresh, "ulan.k", body["password"])
    await fresh.aclose()


async def test_create_user_validation(client):
    await admin_client(client)
    cases = [
        ({"firstName": "", "lastName": "B", "login": "abc"}, 400, "FIELD_REQUIRED", "firstName"),
        ({"firstName": "A", "lastName": " ", "login": "abc"}, 400, "FIELD_REQUIRED", "lastName"),
        ({"firstName": "A" * 61, "lastName": "B", "login": "abc"}, 400, "VALIDATION_ERROR", "firstName"),
        ({"firstName": "A", "lastName": "B", "login": ""}, 400, "FIELD_REQUIRED", "login"),
        ({"firstName": "A", "lastName": "B", "login": "ab"}, 400, "LOGIN_INVALID", "login"),
        ({"firstName": "A", "lastName": "B", "login": "-abc"}, 400, "LOGIN_INVALID", "login"),
        ({"firstName": "A", "lastName": "B", "login": "ab cd"}, 400, "LOGIN_INVALID", "login"),
        ({"firstName": "A", "lastName": "B", "login": "x" * 33}, 400, "LOGIN_INVALID", "login"),
    ]
    for body, status, code, field in cases:
        r = await client.post("/admin/users", json=body)
        assert (r.status_code, r.json()) == (status, {"code": code, "field": field}), body


async def test_create_user_with_a_chosen_password(client):
    await admin_client(client)
    body = {"firstName": "Улан", "lastName": "Касымов", "login": "ulan.k"}
    r = await client.post("/admin/users", json={**body, "password": "tulpar-9421"})
    assert r.status_code == 201 and r.json()["password"] == "tulpar-9421"
    fresh = type(client)(transport=client._transport, base_url="http://test")
    await login_as(fresh, "ulan.k", "tulpar-9421")
    await fresh.aclose()


async def test_a_chosen_password_follows_the_rules(client):
    await admin_client(client)
    cases = [
        ("short1", "PASSWORD_TOO_SHORT"),
        ("onlyletters", "PASSWORD_NEEDS_DIGIT"),
        ("Ulan-2026-ok", "PASSWORD_CONTAINS_NAME"),
        ("aida.b-77x", "PASSWORD_CONTAINS_LOGIN"),
    ]
    for password, code in cases:
        r = await client.post(
            "/admin/users",
            json={"firstName": "Улан", "lastName": "Б", "login": "aida.b", "password": password},
        )
        assert (r.status_code, r.json()) == (400, {"code": code, "field": "password"}), password


async def test_login_taken_is_case_insensitive(client):
    await admin_client(client)
    await client.post("/admin/users", json={"firstName": "A", "lastName": "B", "login": "ulan"})
    r = await client.post("/admin/users", json={"firstName": "B", "lastName": "B", "login": "ULAN"})
    assert (r.status_code, r.json()["code"]) == (409, "LOGIN_TAKEN")


async def test_bad_role_is_validation_error(client):
    await admin_client(client)
    r = await client.post(
        "/admin/users", json={"firstName": "A", "lastName": "B", "login": "abc", "role": "root"}
    )
    assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR")


async def test_disable_enable_and_not_self(client):
    admin = await admin_client(client)
    u = await make_user("ulan")
    assert (await client.post(f"/admin/users/{u.id}/disable")).json()["active"] is False
    assert (await client.post(f"/admin/users/{u.id}/enable")).json()["active"] is True
    r = await client.post(f"/admin/users/{admin.id}/disable")
    assert (r.status_code, r.json()["code"]) == (400, "CANNOT_DISABLE_SELF")
    missing = await client.post("/admin/users/00000000-0000-0000-0000-000000000000/disable")
    assert (missing.status_code, missing.json()["code"]) == (404, "USER_NOT_FOUND")


async def test_reset_password_changes_it(client):
    await admin_client(client)
    u = await make_user("ulan", password="old-pass")
    r = await client.post(f"/admin/users/{u.id}/reset-password")
    new = r.json()["password"]
    fresh = type(client)(transport=client._transport, base_url="http://test")
    bad = await fresh.post("/auth/login", json={"login": "ulan", "password": "old-pass"})
    assert bad.status_code == 401
    await login_as(fresh, "ulan", new)
    await fresh.aclose()


async def test_reset_to_a_chosen_password(client):
    await admin_client(client)
    u = await make_user("ulan", password="old-pass")
    r = await client.post(f"/admin/users/{u.id}/reset-password", json={"password": "tulpar-9421"})
    assert (r.status_code, r.json()) == (200, {"password": "tulpar-9421"})
    fresh = type(client)(transport=client._transport, base_url="http://test")
    await login_as(fresh, "ulan", "tulpar-9421")
    await fresh.aclose()


async def test_a_chosen_reset_password_follows_the_rules(client):
    await admin_client(client)
    u = await make_user("ulan")
    for password, code in [("short1", "PASSWORD_TOO_SHORT"), ("ulan-2026-x", "PASSWORD_CONTAINS_NAME")]:
        r = await client.post(f"/admin/users/{u.id}/reset-password", json={"password": password})
        assert (r.status_code, r.json()) == (400, {"code": code, "field": "password"}), password
