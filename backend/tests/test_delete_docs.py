"""Deleting quizzes and exam sheets: removed when never used, marked deleted when used."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.models.exam import Exam
from app.models.game import Game
from app.models.quiz import Quiz
from tests.test_exams import exam
from tests.test_quizzes import quiz


async def _played(quiz_id: str, owner_id) -> None:
    now = datetime.now(UTC)
    async with SessionLocal() as s:
        s.add(
            Game(
                id=uuid.uuid4(),
                owner_id=owner_id,
                quiz_id=uuid.UUID(quiz_id),
                quiz_title="Math",
                questions=[],
                started_at=now,
                finished_at=now,
                duration_seconds=1,
                audit=[],
            )
        )
        await s.commit()


async def test_an_unused_quiz_is_removed(as_user):
    c, _ = await as_user("ulan")
    qid = (await c.post("/quizzes", json=quiz())).json()["id"]
    assert (await c.delete(f"/quizzes/{qid}")).status_code == 204
    async with SessionLocal() as s:
        assert (await s.execute(select(Quiz))).scalars().all() == []


async def test_a_played_quiz_is_hidden_but_kept(as_user):
    c, user = await as_user("ulan")
    other, _ = await as_user("omur")
    qid = (await c.post("/quizzes", json=quiz())).json()["id"]
    await _played(qid, user.id)
    assert (await c.delete(f"/quizzes/{qid}")).status_code == 204
    assert (await c.get("/quizzes")).json() == []
    assert (await c.get(f"/quizzes/{qid}")).status_code == 404
    assert (await other.get("/quiz-library")).json() == []
    assert (await other.get(f"/quiz-library/{qid}")).status_code == 404
    async with SessionLocal() as s:
        kept = (await s.execute(select(Quiz))).scalar_one()
        assert kept.deleted_at is not None
    assert (await c.delete(f"/quizzes/{qid}")).status_code == 404


async def test_only_the_owner_deletes(as_user):
    c, _ = await as_user("ulan")
    other, _ = await as_user("omur")
    qid = (await c.post("/quizzes", json=quiz())).json()["id"]
    eid = (await c.post("/exams", json=exam())).json()["id"]
    assert (await other.delete(f"/quizzes/{qid}")).status_code == 404
    assert (await other.delete(f"/exams/{eid}")).status_code == 404
    assert len((await c.get("/quizzes")).json()) == 1 and len((await c.get("/exams")).json()) == 1


async def test_exam_sheets_hard_and_soft(as_user):
    admin, _ = await as_user("root", role="admin")
    c, _ = await as_user("ulan")
    unused = (await c.post("/exams", json=exam(title="Unused"))).json()["id"]
    used = (await c.post("/exams", json=exam(title="Used"))).json()["id"]
    gid = (await admin.post("/admin/groups", json={"name": "10-А"})).json()["id"]
    body = {"firstName": "Aizada", "lastName": "K", "login": "aizada", "role": "student", "groupId": gid}
    sid = (await admin.post("/admin/users", json=body)).json()["user"]["id"]
    run = {"examId": used, "groupIds": [gid], "students": [{"studentId": sid, "attendance": "present"}]}
    session_id = (await c.post("/exam-sessions", json=run)).json()["id"]

    assert (await c.delete(f"/exams/{unused}")).status_code == 204
    assert (await c.delete(f"/exams/{used}")).status_code == 204
    assert (await c.get("/exams")).json() == []
    async with SessionLocal() as s:
        rows = (await s.execute(select(Exam))).scalars().all()
        assert [(e.title, e.deleted_at is not None) for e in rows] == [("Used", True)]
    # The exam run from it still opens.
    assert (await c.get(f"/exam-sessions/{session_id}")).json()["title"] == "Used"
    # A deleted sheet can't start another one.
    r = await c.post("/exam-sessions", json=run)
    assert r.json()["code"] == "EXAM_NOT_FOUND"
