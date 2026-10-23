"""A student takes an exam: self-paced, against the server's clock, correct answers never sent."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models.exam_session import ExamAttempt, ExamAttemptEvent
from app.services import exam_attempts
from tests.conftest import login_as
from tests.test_exams import exam, question


class Clock:
    def __init__(self) -> None:
        self.at = datetime(2026, 10, 23, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.at

    def move(self, **delta: float) -> None:
        self.at += timedelta(**delta)


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(exam_attempts, "now", c)
    return c


async def _setup(as_user, client_factory, attendance="present"):
    admin, _ = await as_user("root", role="admin")
    teacher, _ = await as_user("ulan")
    gid = (await admin.post("/admin/groups", json={"name": "10-А"})).json()["id"]
    body = {"firstName": "Aizada", "lastName": "K", "login": "aizada", "role": "student", "groupId": gid}
    created = (await admin.post("/admin/users", json=body)).json()
    sid_student, password = created["user"]["id"], created["password"]
    questions = [
        question("q1"),
        question("q2", answers=["a", "b", "", ""], correct=1),
        question("q3", correct=3),
    ]
    eid = (await teacher.post("/exams", json=exam(minutes=30, questions=questions))).json()["id"]
    late = {"attendance": attendance, "lateMinutes": 5 if attendance == "late" else None}
    session_body = {"examId": eid, "groupIds": [gid], "students": [{"studentId": sid_student, **late}]}
    sid = (await teacher.post("/exam-sessions", json=session_body)).json()["id"]
    student = await client_factory()
    await login_as(student, "aizada", password)
    return teacher, student, sid, sid_student


@pytest.fixture
async def client_factory():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    clients = []

    async def make():
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def test_the_student_sees_the_exam_starts_it_and_never_gets_the_correct_answers(
    as_user, client_factory, clock
):
    teacher, student, sid, _ = await _setup(as_user, client_factory)
    listing = (await student.get("/student/exams")).json()
    assert [(x["id"], x["status"], x["attendance"], x["attempt"]) for x in listing] == [
        (sid, "open", "present", None)
    ]
    before = (await student.get(f"/student/exams/{sid}")).json()
    assert before["questions"] is None and before["questionCount"] == 3

    r = await student.post(f"/student/exams/{sid}/start")
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["attempt"]["state"] == "in_progress" and body["attempt"]["secondsLeft"] == 30 * 60
    assert [q["id"] for q in body["questions"]] == ["q1", "q2", "q3"]
    assert all(set(q) == {"id", "text", "answers"} for q in body["questions"])
    assert "correct" not in r.text

    again = await student.post(f"/student/exams/{sid}/start")
    assert (again.status_code, again.json()["code"]) == (409, "ATTEMPT_EXISTS")
    row = (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]
    assert row["attemptState"] == "in_progress" and row["startedAt"]


async def test_answers_are_saved_changed_and_cleared_then_submitted(as_user, client_factory, clock):
    teacher, student, sid, _ = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")

    def put(qid, a):
        return student.put(f"/student/exams/{sid}/answers/{qid}", json={"answer": a})

    assert (await put("q1", 1)).json()["attempt"]["answers"] == {"q1": 1}
    assert (await put("q1", 2)).json()["attempt"]["answers"] == {"q1": 2}
    await put("q3", 3)
    assert (await put("q3", None)).json()["attempt"]["answers"] == {"q1": 2}
    # A blank answer slot, an unknown question.
    assert (await put("q2", 3)).status_code == 422
    assert (await put("nope", 1)).json()["code"] == "QUESTION_NOT_FOUND"
    # A reload brings the saved answers back.
    assert (await student.get(f"/student/exams/{sid}")).json()["attempt"]["answers"] == {"q1": 2}

    clock.move(minutes=5)
    r = await student.post(f"/student/exams/{sid}/submit")
    assert r.json()["attempt"]["state"] == "submitted" and r.json()["questions"] is None
    assert r.json()["attempt"]["answers"] == {}  # nothing about the answers until the exam closes
    assert (await put("q1", 1)).json()["code"] == "ATTEMPT_FINISHED"
    assert (await student.post(f"/student/exams/{sid}/submit")).json()["code"] == "ATTEMPT_FINISHED"
    async with SessionLocal() as s:
        attempt = (await s.execute(select(ExamAttempt))).scalar_one()
        assert (attempt.submit_reason, attempt.score) == ("manual", 1)
    assert (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]["attemptState"] == "submitted"


async def test_time_up_ends_the_attempt_with_what_was_answered(as_user, client_factory, clock):
    _, student, sid, _ = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    clock.move(minutes=29, seconds=59)
    assert (await student.get(f"/student/exams/{sid}")).json()["attempt"]["secondsLeft"] == 1
    clock.move(seconds=2)  # past the deadline but within the grace: a late save still lands
    r = await student.put(f"/student/exams/{sid}/answers/q3", json={"answer": 3})
    assert r.status_code == 200
    clock.move(seconds=5)
    r = await student.put(f"/student/exams/{sid}/answers/q3", json={"answer": 1})
    assert r.json()["code"] == "ATTEMPT_FINISHED"
    assert (await student.get(f"/student/exams/{sid}")).json()["attempt"]["state"] == "submitted"
    async with SessionLocal() as s:
        attempt = (await s.execute(select(ExamAttempt))).scalar_one()
        assert (attempt.submit_reason, attempt.score, attempt.submitted_at) == (
            "timeout",
            2,
            attempt.deadline_at,
        )


async def test_closing_the_exam_ends_running_attempts_and_blocks_new_ones(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    r = await teacher.put(f"/exam-sessions/{sid}/students/{student_id}", json={"attendance": "absent"})
    assert (r.status_code, r.json()["code"]) == (409, "ATTEMPT_STARTED")
    await teacher.post(f"/exam-sessions/{sid}/close")
    body = (await student.get(f"/student/exams/{sid}")).json()
    assert body["status"] == "closed" and body["attempt"]["state"] == "submitted"
    async with SessionLocal() as s:
        attempt = (await s.execute(select(ExamAttempt))).scalar_one()
        assert (attempt.submit_reason, attempt.score) == ("closed", 1)


async def test_a_closed_exam_cannot_be_started(as_user, client_factory, clock):
    teacher, student, sid, _ = await _setup(as_user, client_factory)
    await teacher.post(f"/exam-sessions/{sid}/close")
    r = await student.post(f"/student/exams/{sid}/start")
    assert (r.status_code, r.json()["code"]) == (409, "SESSION_CLOSED")


async def test_an_absent_student_sees_the_exam_but_cannot_start_it(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _setup(as_user, client_factory, attendance="absent")
    assert (await student.get("/student/exams")).json()[0]["attendance"] == "absent"
    r = await student.post(f"/student/exams/{sid}/start")
    assert (r.status_code, r.json()["code"]) == (403, "STUDENT_ABSENT")
    # The teacher marks them late when they walk in: now they can.
    await teacher.put(
        f"/exam-sessions/{sid}/students/{student_id}", json={"attendance": "late", "lateMinutes": 10}
    )
    r = await student.post(f"/student/exams/{sid}/start")
    assert r.status_code == 200 and r.json()["attempt"]["secondsLeft"] == 30 * 60  # late: same time limit


async def test_a_student_not_on_the_exam_gets_404_and_staff_are_refused(as_user, client_factory, clock):
    teacher, _, sid, _ = await _setup(as_user, client_factory)
    other, _ = await as_user("dana", role="student")
    assert (await other.get("/student/exams")).json() == []
    assert (await other.get(f"/student/exams/{sid}")).json()["code"] == "SESSION_NOT_FOUND"
    assert (await other.post(f"/student/exams/{sid}/start")).status_code == 404
    assert (await teacher.get("/student/exams")).status_code == 403


async def test_screen_signals_are_logged_with_the_question_while_running(as_user, client_factory, clock):
    _, student, sid, _ = await _setup(as_user, client_factory)

    def send(kind, qid=None):
        return student.post(f"/student/exams/{sid}/signals", json={"kind": kind, "questionId": qid})

    assert (await send("TAB_BLUR", "q1")).status_code == 204  # not started: dropped
    await student.post(f"/student/exams/{sid}/start")
    for kind, qid in (("TAB_BLUR", "q1"), ("FULLSCREEN_EXIT", "q2"), ("PASTE", "unknown")):
        assert (await send(kind, qid)).status_code == 204
    assert (await send("SOMETHING")).status_code == 422
    async with SessionLocal() as s:
        rows = (await s.execute(select(ExamAttemptEvent).order_by(ExamAttemptEvent.id))).scalars().all()
        assert [(e.kind, e.question_id) for e in rows] == [
            ("TAB_BLUR", "q1"),
            ("FULLSCREEN_EXIT", "q2"),
            ("PASTE", None),
        ]
