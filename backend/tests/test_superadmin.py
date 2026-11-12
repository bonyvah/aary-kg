"""What the superadmin may do: manage admins, see teachers, students and groups read-only."""

from tests.conftest import make_user


async def test_the_list_has_admins_teachers_and_students_but_no_superadmin(as_user):
    chief, _ = await as_user("chief", role="superadmin")
    await make_user("boss", role="superadmin")
    await make_user("root", role="admin")
    await make_user("ulan")
    await make_user("aida", role="student")
    rows = (await chief.get("/admin/users")).json()
    assert {r["login"]: r["role"] for r in rows} == {"root": "admin", "ulan": "teacher", "aida": "student"}
    assert (await chief.get("/admin/groups")).status_code == 200


async def test_the_superadmin_creates_disables_and_resets_admins(as_user):
    chief, _ = await as_user("chief", role="superadmin")
    r = await chief.post(
        "/admin/users", json={"firstName": "Root", "lastName": "A", "login": "root", "role": "admin"}
    )
    assert r.status_code == 201 and r.json()["user"]["role"] == "admin"
    admin_id = r.json()["user"]["id"]
    assert "password" in (await chief.post(f"/admin/users/{admin_id}/reset-password")).json()
    assert (await chief.post(f"/admin/users/{admin_id}/disable")).json()["active"] is False


async def test_the_superadmin_only_reads_teachers_students_and_groups(as_user):
    chief, me = await as_user("chief", role="superadmin")
    ulan = await make_user("ulan")
    other = await make_user("boss", role="superadmin")
    for role in ("teacher", "student"):
        r = await chief.post(
            "/admin/users", json={"firstName": "X", "lastName": "X", "login": f"x{role}", "role": role}
        )
        assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN"), role
    for target in (ulan, other):
        for action in ("disable", "reset-password"):
            r = await chief.post(f"/admin/users/{target.id}/{action}")
            assert (r.status_code, r.json()["code"]) == (403, "CANNOT_MANAGE_ADMIN"), (target.login, action)
    assert (await chief.post(f"/admin/users/{me.id}/disable")).json()["code"] == "CANNOT_DISABLE_SELF"
    assert (await chief.post("/admin/groups", json={"name": "10A"})).status_code == 403
    assert (await chief.put(f"/admin/users/{ulan.id}/group", json={"groupId": None})).status_code == 403
    assert (await chief.post("/admin/users/bulk", json={"password": "x", "students": [{}]})).status_code in (
        403,
        422,
    )


async def test_an_admin_cannot_touch_a_superadmin(as_user):
    admin, _ = await as_user("root", role="admin")
    chief = await make_user("chief", role="superadmin")
    for action in ("disable", "reset-password"):
        r = await admin.post(f"/admin/users/{chief.id}/{action}")
        assert (r.status_code, r.json()["code"]) == (403, "CANNOT_MANAGE_ADMIN"), action
