"""Groups of students: admins create, rename and delete them, teachers only see them. Names are unique
ignoring case, and a group with students in it can't be deleted."""

from sqlalchemy import update

from app.db import SessionLocal
from app.models.user import User
from tests.conftest import make_user


async def _create(admin, name: str):
    return await admin.post("/admin/groups", json={"name": name})


async def test_an_admin_creates_renames_and_lists_groups(as_user):
    admin, _ = await as_user("root", role="admin")
    r = await _create(admin, "  10-А  ")
    assert r.status_code == 201
    body = r.json()
    assert (body["name"], body["studentCount"], len(body["createdAt"])) == ("10-А", 0, 10)
    await _create(admin, "9-Б")
    assert [g["name"] for g in (await admin.get("/admin/groups")).json()] == ["10-А", "9-Б"]
    r = await admin.put(f"/admin/groups/{body['id']}", json={"name": "11-А"})
    assert (r.status_code, r.json()["name"]) == (200, "11-А")


async def test_names_are_required_short_and_unique_ignoring_case(as_user):
    admin, _ = await as_user("root", role="admin")
    first = (await _create(admin, "10-А")).json()
    for name, status, code in (
        ("   ", 400, "FIELD_REQUIRED"),
        ("x" * 61, 400, "VALIDATION_ERROR"),
        ("10-а", 409, "GROUP_NAME_TAKEN"),
    ):
        r = await _create(admin, name)
        assert (r.status_code, r.json()["code"], r.json()["field"]) == (status, code, "name"), name
    other = (await _create(admin, "9-Б")).json()
    r = await admin.put(f"/admin/groups/{other['id']}", json={"name": "10-А"})
    assert (r.status_code, r.json()["code"]) == (409, "GROUP_NAME_TAKEN")
    # Renaming a group to itself (a case fix) is fine.
    r = await admin.put(f"/admin/groups/{first['id']}", json={"name": "10-а"})
    assert (r.status_code, r.json()["name"]) == (200, "10-а")


async def test_a_group_with_students_is_not_deleted(as_user):
    admin, _ = await as_user("root", role="admin")
    group = (await _create(admin, "10-А")).json()
    student = await make_user("aizada", role="student")
    async with SessionLocal() as s:
        await s.execute(update(User).where(User.id == student.id).values(group_id=group["id"]))
        await s.commit()
    assert (await admin.get("/admin/groups")).json()[0]["studentCount"] == 1
    r = await admin.delete(f"/admin/groups/{group['id']}")
    assert (r.status_code, r.json()["code"]) == (409, "GROUP_NOT_EMPTY")
    async with SessionLocal() as s:
        await s.execute(update(User).where(User.id == student.id).values(group_id=None))
        await s.commit()
    assert (await admin.delete(f"/admin/groups/{group['id']}")).status_code == 204
    assert (await admin.get("/admin/groups")).json() == []
    r = await admin.delete(f"/admin/groups/{group['id']}")
    assert (r.status_code, r.json()["code"]) == (404, "GROUP_NOT_FOUND")


async def test_teachers_see_groups_but_do_not_change_them(as_user):
    admin, _ = await as_user("root", role="admin")
    teacher, _ = await as_user("ulan")
    group = (await _create(admin, "10-А")).json()
    assert [g["name"] for g in (await teacher.get("/groups")).json()] == ["10-А"]
    for r in (
        await teacher.get("/admin/groups"),
        await _create(teacher, "9-Б"),
        await teacher.put(f"/admin/groups/{group['id']}", json={"name": "x"}),
        await teacher.delete(f"/admin/groups/{group['id']}"),
    ):
        assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")
