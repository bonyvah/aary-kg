def question(qid="q1", **over):
    base = {"id": qid, "text": "2 + 2?", "answers": ["3", "4", "5", "6"], "correct": 2}
    return {**base, **over}


def exam(**over):
    return {**{"title": "Algebra", "minutes": 30, "questions": [question()]}, **over}


async def test_requires_login(client):
    assert (await client.get("/exams")).status_code == 401
    assert (await client.post("/exams", json=exam())).status_code == 401


async def test_create_get_list_and_update(as_user):
    c, _ = await as_user("ulan")
    r = await c.post("/exams", json=exam(title="  Algebra  "))
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Algebra" and body["minutes"] == 30
    assert body["questions"] == [{**question(), "image": None}]  # no per-question time
    eid = body["id"]

    assert (await c.get(f"/exams/{eid}")).json() == body
    listing = (await c.get("/exams")).json()
    assert listing == [{"id": eid, "title": "Algebra", "minutes": 30, "questionCount": 1}]

    two = exam(title="Algebra 2", minutes=45, questions=[question("q1"), question("q2", correct=4)])
    r = await c.put(f"/exams/{eid}", json=two)
    assert r.status_code == 200 and r.json()["minutes"] == 45
    assert [q["id"] for q in r.json()["questions"]] == ["q1", "q2"]
    assert (await c.get("/exams")).json()[0]["questionCount"] == 2


async def test_a_custom_time_limit_is_kept(as_user):
    c, _ = await as_user("ulan")
    r = await c.post("/exams", json=exam(minutes=95))
    assert r.status_code == 201 and r.json()["minutes"] == 95


async def test_blank_fields_are_reported_with_editor_keys(as_user):
    c, _ = await as_user("ulan")
    bad = exam(title=" ", questions=[question("a", text=""), question("b", answers=["1", "", "", " "])])
    r = await c.post("/exams", json=bad)
    assert r.status_code == 400 and r.json()["code"] == "EXAM_INVALID"
    fields = [i["field"] for i in r.json()["issues"]]
    assert fields == ["title", "a:text", "b:answer:2", "b:answer:3", "b:answer:4"]
    assert (await c.get("/exams")).json() == []


async def test_shape_errors_are_validation_errors(as_user):
    c, _ = await as_user("ulan")
    cases = [
        exam(questions=[]),
        exam(questions=[question(answers=["a", "b", "c"])]),
        exam(questions=[question(correct=5)]),
        exam(minutes=4),
        exam(minutes=181),
        exam(questions=[question("x"), question("x")]),
    ]
    for body in cases:
        r = await c.post("/exams", json=body)
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), body


async def test_an_exam_belongs_to_its_owner_alone(as_user):
    owner, _ = await as_user("ulan")
    other, _ = await as_user("omur")
    admin, _ = await as_user("root", role="admin")
    eid = (await owner.post("/exams", json=exam())).json()["id"]

    for c in (other, admin):
        assert (await c.get(f"/exams/{eid}")).json()["code"] == "EXAM_NOT_FOUND"
        assert (await c.put(f"/exams/{eid}", json=exam(title="Hijacked"))).status_code == 404
        assert (await c.get("/exams")).json() == []
    assert (await owner.get(f"/exams/{eid}")).json()["title"] == "Algebra"


async def test_only_a_teacher_creates_an_exam(as_user):
    admin, _ = await as_user("root", role="admin")
    r = await admin.post("/exams", json=exam())
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")


async def test_a_student_is_refused(as_user):
    student, _ = await as_user("aizada", role="student")
    assert (await student.get("/exams")).status_code == 403
    assert (await student.post("/exams", json=exam())).status_code == 403


async def test_unknown_exam_is_404(as_user):
    c, _ = await as_user("ulan")
    r = await c.get("/exams/00000000-0000-0000-0000-000000000000")
    assert (r.status_code, r.json()["code"]) == (404, "EXAM_NOT_FOUND")


async def test_exam_questions_have_images_but_the_sheet_has_no_cover(as_user):
    c, _ = await as_user("ulan")
    r = await c.post("/exams", json=exam(questions=[question(image="c" * 64)]))
    assert r.status_code == 201
    assert r.json()["questions"][0]["image"] == "c" * 64 and "image" not in r.json()
