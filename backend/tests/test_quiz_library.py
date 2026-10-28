"""Teachers browse each other's quizzes, read them and copy one into their own."""

from tests.test_quizzes import question, quiz


async def test_a_teacher_sees_others_quizzes_and_copies_one(as_user):
    ulan, _ = await as_user("ulan")
    omur, _ = await as_user("omur")
    mine = (await ulan.post("/quizzes", json=quiz(title="Mine"))).json()["id"]
    theirs = (
        await omur.post("/quizzes", json=quiz(title="Theirs", questions=[question("a"), question("b")]))
    ).json()

    listing = (await ulan.get("/quiz-library")).json()
    assert [(x["title"], x["ownerName"], x["questionCount"]) for x in listing] == [("Theirs", "Omur", 2)]
    assert (await ulan.get(f"/quiz-library/{mine}")).json()[
        "code"
    ] == "QUIZ_NOT_FOUND"  # one's own: the dashboard

    read = (await ulan.get(f"/quiz-library/{theirs['id']}")).json()
    assert (read["ownerName"], [q["id"] for q in read["questions"]]) == ("Omur", ["a", "b"])

    r = await ulan.post(f"/quiz-library/{theirs['id']}/copy")
    assert r.status_code == 201
    copy = r.json()
    assert (
        copy["id"] != theirs["id"] and copy["title"] == "Theirs" and copy["questions"] == theirs["questions"]
    )
    assert {q["title"] for q in (await ulan.get("/quizzes")).json()} == {"Mine", "Theirs"}

    # The copy is apart: the original changes, the copy doesn't.
    await omur.put(f"/quizzes/{theirs['id']}", json=quiz(title="Changed"))
    assert (await ulan.get(f"/quizzes/{copy['id']}")).json()["title"] == "Theirs"
    assert (await omur.get(f"/quizzes/{copy['id']}")).status_code == 404


async def test_only_teachers_use_the_library(as_user):
    admin, _ = await as_user("root", role="admin")
    student, _ = await as_user("aizada", role="student")
    for c in (admin, student):
        assert (await c.get("/quiz-library")).status_code == 403
