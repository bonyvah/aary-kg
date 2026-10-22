"""Students: created by an admin inside one group, moved between groups, signed in like teachers but
kept off every staff screen, and never picked as jury."""

from tests.conftest import login_as, make_user
from tests.test_contests import payload


async def _group(admin, name: str = "10-А") -> str:
    return (await admin.post("/admin/groups", json={"name": name})).json()["id"]


async def _student(admin, group_id, login: str = "aizada"):
    return await admin.post(
        "/admin/users",
        json={"firstName": "Aizada", "lastName": "K", "login": login, "role": "student", "groupId": group_id},
    )


async def test_an_admin_creates_a_student_in_a_group(as_user):
    admin, _ = await as_user("root", role="admin")
    gid = await _group(admin)
    r = await _student(admin, gid)
    assert r.status_code == 201
    user = r.json()["user"]
    assert (user["role"], user["groupId"], user["groupName"]) == ("student", gid, "10-А")
    row = next(u for u in (await admin.get("/admin/users")).json() if u["login"] == "aizada")
    assert (row["groupId"], row["groupName"]) == (gid, "10-А")
    assert (await admin.get("/admin/groups")).json()[0]["studentCount"] == 1


async def test_a_student_needs_a_real_group_and_a_teacher_has_none(as_user):
    admin, _ = await as_user("root", role="admin")
    gid = await _group(admin)
    r = await _student(admin, None)
    assert (r.status_code, r.json()["code"], r.json()["field"]) == (400, "GROUP_REQUIRED", "groupId")
    r = await _student(admin, "00000000-0000-0000-0000-000000000000")
    assert (r.status_code, r.json()["code"]) == (404, "GROUP_NOT_FOUND")
    r = await admin.post(
        "/admin/users", json={"firstName": "U", "lastName": "K", "login": "ulan", "groupId": gid}
    )
    assert (r.status_code, r.json()["code"], r.json()["field"]) == (400, "VALIDATION_ERROR", "groupId")
    teacher = (
        await admin.post("/admin/users", json={"firstName": "U", "lastName": "K", "login": "ulan"})
    ).json()["user"]
    assert (teacher["role"], teacher["groupId"], teacher["groupName"]) == ("teacher", None, None)


async def test_an_admin_moves_a_student_to_another_group(as_user):
    admin, _ = await as_user("root", role="admin")
    a, b = await _group(admin, "10-А"), await _group(admin, "10-Б")
    sid = (await _student(admin, a)).json()["user"]["id"]
    r = await admin.put(f"/admin/users/{sid}/group", json={"groupId": b})
    assert (r.status_code, r.json()["groupName"]) == (200, "10-Б")
    assert (await admin.delete(f"/admin/groups/{a}")).status_code == 204  # empty now
    r = await admin.put(f"/admin/users/{sid}/group", json={"groupId": None})
    assert (r.status_code, r.json()["code"]) == (400, "GROUP_REQUIRED")
    teacher = await make_user("ulan")
    r = await admin.put(f"/admin/users/{teacher.id}/group", json={"groupId": b})
    assert (r.status_code, r.json()["code"]) == (400, "NOT_A_STUDENT")


async def test_a_student_signs_in_but_reaches_no_staff_screen(client, as_user):
    admin, _ = await as_user("root", role="admin")
    created = (await _student(admin, await _group(admin))).json()
    await login_as(client, "aizada", created["password"])
    me = (await client.get("/auth/me")).json()
    assert (me["role"], me["groupName"]) == ("student", "10-А")
    for path in ("/quizzes", "/contests", "/games", "/groups", "/users/directory", "/admin/users"):
        assert (await client.get(path)).status_code == 403, path


async def test_a_student_is_never_jury(as_user):
    admin, _ = await as_user("root", role="admin")
    owner, _ = await as_user("ulan")
    student = await make_user("aizada", role="student")
    r = await owner.post("/contests", json=payload([student]))
    assert (r.status_code, r.json()["code"]) == (400, "USER_NOT_FOUND")
