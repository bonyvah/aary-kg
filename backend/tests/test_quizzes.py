def question(qid="q1", **over):
    base = {"id": qid, "text": "2 + 2?", "answers": ["3", "4", "5", "6"], "correct": 2, "seconds": 20}
    return {**base, **over}


def quiz(**over):
    return {**{"title": "Math", "questions": [question()]}, **over}


async def test_requires_login(client):
    assert (await client.get("/quizzes")).status_code == 401
    assert (await client.post("/quizzes", json=quiz())).status_code == 401


async def test_create_get_list_and_update(as_user):
    c, _ = await as_user("ulan")
    r = await c.post("/quizzes", json=quiz(title="  Math  "))
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Math" and body["status"] == "ready"
    assert body["questions"][0] == question()  # ids and order kept as the editor sent them
    qid = body["id"]

    assert (await c.get(f"/quizzes/{qid}")).json() == body
    listing = (await c.get("/quizzes")).json()
    assert listing == [{"id": qid, "title": "Math", "status": "ready", "questionCount": 1}]

    two = quiz(title="Math 2", questions=[question("q1"), question("q2", correct=4, seconds=60)])
    r = await c.put(f"/quizzes/{qid}", json=two)
    assert r.status_code == 200 and [q["id"] for q in r.json()["questions"]] == ["q1", "q2"]
    assert (await c.get("/quizzes")).json()[0]["questionCount"] == 2


async def test_blank_fields_are_reported_with_editor_keys(as_user):
    c, _ = await as_user("ulan")
    bad = quiz(title=" ", questions=[question("a", text=""), question("b", answers=["1", "", "3", " "])])
    r = await c.post("/quizzes", json=bad)
    assert r.status_code == 400 and r.json()["code"] == "QUIZ_INVALID"
    fields = [i["field"] for i in r.json()["issues"]]
    assert fields == ["title", "a:text", "b:answer:2", "b:answer:4"]
    assert all(i["code"] == "FIELD_REQUIRED" for i in r.json()["issues"])
    assert (await c.get("/quizzes")).json() == []  # nothing saved


async def test_shape_errors_are_validation_errors(as_user):
    c, _ = await as_user("ulan")
    cases = [
        quiz(questions=[]),
        quiz(questions=[question(answers=["a", "b", "c"])]),
        quiz(questions=[question(correct=5)]),
        quiz(questions=[question(seconds=15)]),
        quiz(questions=[question("x"), question("x")]),
    ]
    for body in cases:
        r = await c.post("/quizzes", json=body)
        assert (r.status_code, r.json()["code"]) == (422, "VALIDATION_ERROR"), body


async def test_a_quiz_belongs_to_its_owner_alone_not_even_an_admin_edits_it(as_user):
    owner, _ = await as_user("ulan")
    other, _ = await as_user("omur")
    admin, _ = await as_user("root", role="admin")
    qid = (await owner.post("/quizzes", json=quiz())).json()["id"]

    for c in (other, admin):
        assert (await c.get(f"/quizzes/{qid}")).json()["code"] == "QUIZ_NOT_FOUND"
        assert (await c.put(f"/quizzes/{qid}", json=quiz(title="Hijacked"))).status_code == 404
    assert (await other.get("/quizzes")).json() == [] and (await admin.get("/quizzes")).json() == []
    assert (await owner.get(f"/quizzes/{qid}")).json()["title"] == "Math"


async def test_an_admin_cannot_create_a_quiz(as_user):
    admin, _ = await as_user("root", role="admin")
    r = await admin.post("/quizzes", json=quiz())
    assert (r.status_code, r.json()["code"]) == (403, "FORBIDDEN")
    assert (await admin.get("/quizzes")).json() == []


async def test_unknown_quiz_is_404(as_user):
    c, _ = await as_user("ulan")
    r = await c.get("/quizzes/00000000-0000-0000-0000-000000000000")
    assert (r.status_code, r.json()["code"]) == (404, "QUIZ_NOT_FOUND")
