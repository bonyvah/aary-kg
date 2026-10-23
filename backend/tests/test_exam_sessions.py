"""Exam sessions: a teacher starts one from an exam sheet for chosen students, marks attendance and
closes it. The session keeps its own copy of the sheet."""

from tests.test_exams import exam, question


async def _setup(as_user):
    admin, _ = await as_user("root", role="admin")
    teacher, _ = await as_user("ulan")
    gid = (await admin.post("/admin/groups", json={"name": "10-А"})).json()["id"]
    other_gid = (await admin.post("/admin/groups", json={"name": "10-Б"})).json()["id"]
    ids = {}
    for login, group in (("aizada", gid), ("bakyt", gid), ("cholpon", other_gid)):
        body = {
            "firstName": login.title(),
            "lastName": "K",
            "login": login,
            "role": "student",
            "groupId": group,
        }
        ids[login] = (await admin.post("/admin/users", json=body)).json()["user"]["id"]
    eid = (await teacher.post("/exams", json=exam())).json()["id"]
    return admin, teacher, gid, ids, eid


def _start(eid, gid, ids, **attendance):
    students = [{"studentId": ids[login], "attendance": "present"} for login in ("aizada", "bakyt")]
    for row in students:
        login = next(k for k, v in ids.items() if v == row["studentId"])
        if login in attendance:
            row.update(attendance[login])
    return {"examId": eid, "groupIds": [gid], "students": students}


async def test_the_staff_see_the_active_students_with_their_group(as_user):
    _, teacher, _, ids, _ = await _setup(as_user)
    rows = (await teacher.get("/users/students")).json()
    assert [(r["name"], r["groupName"]) for r in rows] == [
        ("Aizada K", "10-А"),
        ("Bakyt K", "10-А"),
        ("Cholpon K", "10-Б"),
    ]
    assert set(rows[0]) == {"id", "name", "groupId", "groupName"}


async def test_start_a_session_it_opens_at_once_with_a_copy_of_the_sheet(as_user):
    _, teacher, gid, ids, eid = await _setup(as_user)
    body = _start(eid, gid, ids, bakyt={"attendance": "late", "lateMinutes": 10})
    r = await teacher.post("/exam-sessions", json=body)
    assert r.status_code == 201, r.json()
    s = r.json()
    assert (s["status"], s["title"], s["minutes"], s["questionCount"], s["closedAt"]) == (
        "open",
        "Algebra",
        30,
        1,
        None,
    )
    assert s["groups"] == [{"id": gid, "name": "10-А"}]
    assert [(row["name"], row["attendance"], row["lateMinutes"]) for row in s["students"]] == [
        ("Aizada K", "present", None),
        ("Bakyt K", "late", 10),
    ]

    # Editing the sheet afterwards doesn't touch the session.
    await teacher.put(
        f"/exams/{eid}", json=exam(title="Changed", minutes=60, questions=[question("a"), question("b")])
    )
    again = (await teacher.get(f"/exam-sessions/{s['id']}")).json()
    assert (again["title"], again["minutes"], again["questionCount"]) == ("Algebra", 30, 1)

    listing = (await teacher.get("/exam-sessions")).json()
    assert [
        (x["id"], x["status"], x["groupNames"], x["studentCount"], x["absentCount"]) for x in listing
    ] == [(s["id"], "open", ["10-А"], 2, 0)]


async def test_a_student_from_another_group_can_be_added(as_user):
    _, teacher, gid, ids, eid = await _setup(as_user)
    body = _start(eid, gid, ids)
    body["students"].append({"studentId": ids["cholpon"], "attendance": "absent"})
    s = (await teacher.post("/exam-sessions", json=body)).json()
    assert [(row["groupName"], row["attendance"]) for row in s["students"]][-1] == ("10-Б", "absent")


async def test_late_needs_minutes_and_other_marks_drop_them(as_user):
    _, teacher, gid, ids, eid = await _setup(as_user)
    r = await teacher.post("/exam-sessions", json=_start(eid, gid, ids, aizada={"attendance": "late"}))
    assert (r.status_code, r.json()["code"], r.json()["field"]) == (422, "VALIDATION_ERROR", "lateMinutes")
    body = _start(eid, gid, ids, aizada={"attendance": "absent", "lateMinutes": 5})
    s = (await teacher.post("/exam-sessions", json=body)).json()
    assert s["students"][0]["lateMinutes"] is None
    for minutes in (0, 181):
        r = await teacher.post(
            "/exam-sessions",
            json=_start(eid, gid, ids, aizada={"attendance": "late", "lateMinutes": minutes}),
        )
        assert r.status_code == 422


async def test_bad_targets_are_refused(as_user):
    admin, teacher, gid, ids, eid = await _setup(as_user)
    r = await teacher.post("/exam-sessions", json={"examId": eid, "groupIds": [gid], "students": []})
    assert (r.status_code, r.json()["code"]) == (400, "SESSION_NO_STUDENTS")
    unknown = "00000000-0000-0000-0000-000000000000"
    r = await teacher.post("/exam-sessions", json={**_start(eid, gid, ids), "groupIds": [unknown]})
    assert r.json()["code"] == "GROUP_NOT_FOUND"
    _, t2 = await as_user("omur")
    r = await teacher.post(
        "/exam-sessions",
        json={**_start(eid, gid, ids), "students": [{"studentId": str(t2.id), "attendance": "present"}]},
    )
    assert r.json()["code"] == "STUDENT_NOT_FOUND"  # a teacher is not a student
    dup = _start(eid, gid, ids)
    dup["students"].append(dup["students"][0])
    assert (await teacher.post("/exam-sessions", json=dup)).status_code == 422
    assert (await teacher.get("/exam-sessions")).json() == []


async def test_only_the_owner_of_the_sheet_starts_and_sees_a_session(as_user):
    admin, teacher, gid, ids, eid = await _setup(as_user)
    other, _ = await as_user("omur")
    r = await other.post("/exam-sessions", json=_start(eid, gid, ids))
    assert (r.status_code, r.json()["code"]) == (404, "EXAM_NOT_FOUND")
    assert (await admin.post("/exam-sessions", json=_start(eid, gid, ids))).status_code == 403
    sid = (await teacher.post("/exam-sessions", json=_start(eid, gid, ids))).json()["id"]
    for c in (other, admin):
        assert (await c.get(f"/exam-sessions/{sid}")).json()["code"] == "SESSION_NOT_FOUND"
        assert (await c.post(f"/exam-sessions/{sid}/close")).status_code == 404
        assert (await c.get("/exam-sessions")).json() == []


async def test_attendance_changes_while_open_and_a_student_can_be_added(as_user):
    _, teacher, gid, ids, eid = await _setup(as_user)
    sid = (
        await teacher.post("/exam-sessions", json=_start(eid, gid, ids, bakyt={"attendance": "absent"}))
    ).json()["id"]
    r = await teacher.put(
        f"/exam-sessions/{sid}/students/{ids['bakyt']}", json={"attendance": "late", "lateMinutes": 15}
    )
    assert r.status_code == 200 and r.json()["students"][1]["attendance"] == "late"
    r = await teacher.put(f"/exam-sessions/{sid}/students/{ids['cholpon']}", json={"attendance": "present"})
    assert [row["name"] for row in r.json()["students"]] == ["Aizada K", "Bakyt K", "Cholpon K"]
    r = await teacher.put(f"/exam-sessions/{sid}/students/{ids['aizada']}", json={"attendance": "late"})
    assert r.status_code == 422


async def test_close_is_final(as_user):
    _, teacher, gid, ids, eid = await _setup(as_user)
    sid = (await teacher.post("/exam-sessions", json=_start(eid, gid, ids))).json()["id"]
    r = await teacher.post(f"/exam-sessions/{sid}/close")
    assert r.status_code == 200 and r.json()["status"] == "closed" and r.json()["closedAt"]
    r = await teacher.post(f"/exam-sessions/{sid}/close")
    assert (r.status_code, r.json()["code"]) == (409, "SESSION_CLOSED")
    r = await teacher.put(f"/exam-sessions/{sid}/students/{ids['aizada']}", json={"attendance": "absent"})
    assert (r.status_code, r.json()["code"]) == (409, "SESSION_CLOSED")


async def test_a_student_is_refused(as_user):
    _, _, gid, ids, eid = await _setup(as_user)
    student, _ = await as_user("dana", role="student")
    assert (await student.get("/exam-sessions")).status_code == 403
    assert (await student.get("/users/students")).status_code == 403
    assert (await student.post("/exam-sessions", json=_start(eid, gid, ids))).status_code == 403
