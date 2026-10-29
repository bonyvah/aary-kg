"""What an admin may and may not do: manage users, contests and the data of finished games, but not
create quizzes, contests or games, not run a game, not touch another admin."""

from tests.conftest import make_user
from tests.test_contests import make_contest


async def test_the_users_list_has_teachers_and_students_but_no_admin(as_user):
    admin, _ = await as_user("root", role="admin")
    await make_user("boss", role="admin")
    await make_user("ulan")
    await make_user("aida", role="student")
    rows = (await admin.get("/admin/users")).json()
    assert {r["login"] for r in rows} == {"ulan", "aida"}  # neither "root" nor "boss"


async def test_an_admin_can_only_create_teachers(as_user):
    admin, _ = await as_user("root", role="admin")
    ok = await admin.post("/admin/users", json={"firstName": "Ulan", "lastName": "X", "login": "ulan"})
    assert ok.status_code == 201 and ok.json()["user"]["role"] == "teacher"  # the default
    for role in ("admin", "user", "root", ""):
        r = await admin.post(
            "/admin/users",
            json={"firstName": "X", "lastName": "X", "login": f"x{len(role)}abc", "role": role},
        )
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), role
    assert {r["login"] for r in (await admin.get("/admin/users")).json()} == {"ulan"}


async def test_another_admin_cannot_be_disabled_or_reset(as_user):
    admin, me = await as_user("root", role="admin")
    boss = await make_user("boss", role="admin")
    for path in (
        f"/admin/users/{boss.id}/disable",
        f"/admin/users/{boss.id}/enable",
        f"/admin/users/{boss.id}/reset-password",
    ):
        r = await admin.post(path)
        assert (r.status_code, r.json()["code"]) == (403, "CANNOT_MANAGE_ADMIN"), path
    # nor themselves
    assert (await admin.post(f"/admin/users/{me.id}/disable")).json()["code"] == "CANNOT_DISABLE_SELF"
    assert (await admin.post(f"/admin/users/{me.id}/reset-password")).json()["code"] == "CANNOT_MANAGE_ADMIN"
    # the other admin's password still works
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (
            await c.post("/auth/login", json={"login": "boss", "password": "pw-12345"})
        ).status_code == 200


async def test_regular_users_are_still_managed_normally(as_user):
    admin, _ = await as_user("root", role="admin")
    ulan = await make_user("ulan")
    assert (await admin.post(f"/admin/users/{ulan.id}/disable")).json()["active"] is False
    assert (await admin.post(f"/admin/users/{ulan.id}/enable")).json()["active"] is True
    assert "password" in (await admin.post(f"/admin/users/{ulan.id}/reset-password")).json()


async def test_an_admin_does_not_create_contests_but_still_manages_them(as_user):
    owner, _ = await as_user("ulan")
    _, jury = await as_user("omur")
    admin, _ = await as_user("root", role="admin")
    from tests.test_contests import payload

    r = await admin.post("/contests", json=payload([jury]))
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")
    cid = (await make_contest(owner, [jury]))["id"]
    assert (await admin.get(f"/contests/{cid}")).status_code == 200  # sees everything
    assert (await admin.post(f"/contests/{cid}/open")).json()["status"] == "open"  # and manages it
    assert (await admin.post(f"/contests/{cid}/close")).json()["status"] == "closed"
    assert [c["id"] for c in (await admin.get("/admin/contests")).json()] == [cid]


async def test_only_admins_see_everybodys_games_and_the_list_names_the_host(client, as_user):
    from tests.test_games_api import join, make_game, play_to_the_end

    host, _, _, game = await make_game(as_user)
    pid = (await join(client, game["pin"], "Aida")).json()["player"]["id"]
    await play_to_the_end(game, [(pid, [1, 2])])
    import asyncio

    await asyncio.sleep(0.1)
    admin, _ = await as_user("root", role="admin")
    rows = (await admin.get("/admin/games")).json()
    assert [(r["quizTitle"], r["ownerName"], r["playerCount"]) for r in rows] == [("Geography", "Host1", 1)]
    assert (await admin.get("/games")).json() == []  # /games is "games I hosted"
    assert (await host.get("/admin/games")).status_code == 403
    assert (await client.get("/admin/games")).status_code == 401
