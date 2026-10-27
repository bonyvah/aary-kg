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


async def test_the_result_is_shown_only_once_the_exam_is_closed(as_user, client_factory, clock):
    teacher, student, sid, _ = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    await student.put(f"/student/exams/{sid}/answers/q2", json={"answer": 2})
    r = await student.post(f"/student/exams/{sid}/submit")
    assert r.json()["result"] is None and "correct" not in r.text  # handed in, the exam still open

    await teacher.post(f"/exam-sessions/{sid}/close")
    body = (await student.get(f"/student/exams/{sid}")).json()
    assert (body["result"]["score"], body["result"]["total"]) == (1, 3)
    assert [(q["id"], q["correct"], q["chosen"]) for q in body["result"]["questions"]] == [
        ("q1", 2, 2),
        ("q2", 1, 2),
        ("q3", 3, None),
    ]
    listed = (await student.get("/student/exams")).json()[0]["result"]
    assert (listed["score"], listed["total"], listed["questions"]) == (1, 3, [])


async def test_no_result_for_a_student_who_did_not_take_it(as_user, client_factory, clock):
    teacher, student, sid, _ = await _setup(as_user, client_factory)
    await teacher.post(f"/exam-sessions/{sid}/close")
    assert (await student.get(f"/student/exams/{sid}")).json()["result"] is None


async def test_the_teacher_sees_scores_reasons_signals_and_answers(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    for kind, qid in (("TAB_BLUR", "q1"), ("TAB_BLUR", "q2"), ("PASTE", "q2")):
        await student.post(f"/student/exams/{sid}/signals", json={"kind": kind, "questionId": qid})
    row = (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]
    assert (row["score"], row["submitReason"]) == (None, None)  # still writing
    assert row["signals"] == [{"kind": "TAB_BLUR", "count": 2}, {"kind": "PASTE", "count": 1}]

    clock.move(minutes=31)
    row = (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]
    assert (row["attemptState"], row["submitReason"], row["score"]) == ("submitted", "timeout", 1)

    detail = (await teacher.get(f"/exam-sessions/{sid}/students/{student_id}")).json()
    assert detail["total"] == 3
    detail = detail["attempts"][0]
    assert (detail["score"], detail["submitReason"], detail["counts"], detail["number"]) == (
        1,
        "timeout",
        True,
        1,
    )
    assert [(q["id"], q["chosen"], q["correct"]) for q in detail["questions"]] == [
        ("q1", 2, 2),
        ("q2", None, 1),
        ("q3", None, 3),
    ]
    assert [(e["kind"], e["questionId"]) for e in detail["signals"]] == [
        ("TAB_BLUR", "q1"),
        ("TAB_BLUR", "q2"),
        ("PASTE", "q2"),
    ]
    admin, _ = await as_user("root2", role="admin")
    assert (await admin.get(f"/exam-sessions/{sid}/students/{student_id}")).json()["attempts"][0][
        "score"
    ] == 1
    other, _ = await as_user("omur")
    assert (await other.get(f"/exam-sessions/{sid}/students/{student_id}")).status_code == 404
    assert (await student.get(f"/exam-sessions/{sid}/students/{student_id}")).status_code == 403


async def _suspect_attempt(as_user, client_factory, signal="TAB_BLUR"):
    teacher, student, sid, student_id = await _setup(as_user, client_factory)
    await student.post(f"/student/exams/{sid}/start")
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})  # right
    await student.put(f"/student/exams/{sid}/answers/q3", json={"answer": 3})  # right
    await student.post(f"/student/exams/{sid}/signals", json={"kind": signal, "questionId": "q3"})
    return teacher, student, sid, student_id


async def test_rulings_change_the_score_and_are_audited(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _suspect_attempt(as_user, client_factory)
    url = f"/exam-sessions/{sid}/students/{student_id}/decision"
    r = await teacher.put(url, json={"decision": "zero"})
    assert (r.status_code, r.json()["code"]) == (409, "ATTEMPT_RUNNING")
    await student.post(f"/student/exams/{sid}/submit")
    row = (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]
    assert (row["suspect"], row["score"], row["rawScore"], row["decision"]) == (True, 2, 2, None)

    row = (await teacher.put(url, json={"decision": "zero"})).json()["students"][0]
    assert (row["score"], row["rawScore"], row["decision"]) == (0, 2, "zero")
    # Changed the next day: q3 doesn't count, q1 keeps its point.
    r = await teacher.put(url, json={"decision": "individual", "questions": {"q3": "skip", "q1": "mercy"}})
    assert r.json()["students"][0]["score"] == 1
    assert (await teacher.put(url, json={"decision": "individual", "questions": {"q3": "skip"}})).json()[
        "code"
    ] == "NOTHING_TO_CHANGE"
    row = (await teacher.put(url, json={"decision": "mercy"})).json()["students"][0]
    assert row["score"] == 2

    detail = (await teacher.get(f"/exam-sessions/{sid}/students/{student_id}")).json()
    assert [(h["actorName"], h["before"]["decision"], h["after"]["decision"]) for h in detail["history"]] == [
        ("Ulan", None, "zero"),
        ("Ulan", "zero", "individual"),
        ("Ulan", "individual", "mercy"),
    ]
    assert detail["history"][1]["after"]["questions"] == {"q3": "skip"}

    # What the student sees after the close follows the ruling.
    await teacher.put(url, json={"decision": "individual", "questions": {"q3": "skip"}})
    await teacher.post(f"/exam-sessions/{sid}/close")
    result = (await student.get(f"/student/exams/{sid}")).json()["result"]
    assert result["score"] == 1 and [q["counted"] for q in result["questions"]] == [True, True, False]
    # Rulings can still change after the close.
    assert (await teacher.put(url, json={"decision": "mercy"})).status_code == 200
    assert (await student.get(f"/student/exams/{sid}")).json()["result"]["score"] == 2


async def test_only_suspects_get_rulings_and_only_from_the_owner(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _suspect_attempt(as_user, client_factory, signal="PASTE")
    await student.post(f"/student/exams/{sid}/submit")
    url = f"/exam-sessions/{sid}/students/{student_id}/decision"
    r = await teacher.put(url, json={"decision": "zero"})
    assert (r.status_code, r.json()["code"]) == (409, "NOT_A_SUSPECT")  # pasting alone is no reason
    assert (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]["suspect"] is False
    admin, _ = await as_user("root2", role="admin")
    assert (await admin.put(url, json={"decision": "zero"})).status_code == 404
    bad = await teacher.put(url, json={"decision": "individual", "questions": {"nope": "skip"}})
    assert bad.status_code in (404, 409)


async def test_a_second_attempt_is_granted_logged_and_counts(as_user, client_factory, clock):
    teacher, student, sid, student_id = await _setup(as_user, client_factory)
    grant = f"/exam-sessions/{sid}/students/{student_id}/grant"
    assert (await teacher.post(grant)).json()["code"] == "CANNOT_GRANT"  # nothing taken yet
    await student.post(f"/student/exams/{sid}/start")
    assert (await teacher.post(grant)).json()["code"] == "CANNOT_GRANT"  # still writing
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    await student.post(f"/student/exams/{sid}/submit")
    assert (await student.get(f"/student/exams/{sid}")).json()["canStart"] is False

    row = (await teacher.post(grant)).json()["students"][0]
    assert (row["attemptCount"], row["canGrant"]) == (1, False)
    assert (await teacher.post(grant)).json()["code"] == "CANNOT_GRANT"  # one waiting already
    assert (await student.get(f"/student/exams/{sid}")).json()["canStart"] is True

    clock.move(minutes=1)
    second = (await student.post(f"/student/exams/{sid}/start")).json()
    assert second["attempt"]["state"] == "in_progress" and second["attempt"]["answers"] == {}
    await student.put(f"/student/exams/{sid}/answers/q1", json={"answer": 2})
    await student.put(f"/student/exams/{sid}/answers/q3", json={"answer": 3})
    await student.post(f"/student/exams/{sid}/submit")

    row = (await teacher.get(f"/exam-sessions/{sid}")).json()["students"][0]
    assert (row["attemptCount"], row["score"], row["canGrant"]) == (2, 2, True)
    detail = (await teacher.get(f"/exam-sessions/{sid}/students/{student_id}")).json()
    assert [(a["number"], a["score"], a["counts"], a["active"]) for a in detail["attempts"]] == [
        (1, 1, False, True),
        (2, 2, True, True),
    ]
    assert [(h["action"], h["before"], h["after"]) for h in detail["history"]] == [
        ("grant", {"attempts": 1}, {"attempts": 2})
    ]

    # Only an admin inactivates; the latest active one then counts.
    second_id = detail["attempts"][1]["id"]
    assert (await teacher.post(f"/admin/exam-attempts/{second_id}/inactivate")).status_code == 403
    admin, _ = await as_user("root2", role="admin")
    row = (await admin.post(f"/admin/exam-attempts/{second_id}/inactivate")).json()["students"][0]
    assert row["score"] == 1
    again = await admin.post(f"/admin/exam-attempts/{second_id}/inactivate")
    assert (again.status_code, again.json()["code"]) == (409, "ATTEMPT_INACTIVE")
    detail = (await teacher.get(f"/exam-sessions/{sid}/students/{student_id}")).json()
    assert [(a["counts"], a["active"]) for a in detail["attempts"]] == [(True, True), (False, False)]
    assert [(h["action"], h["actorName"]) for h in detail["history"]] == [
        ("grant", "Ulan"),
        ("inactivate", "Root2"),
    ]

    await teacher.post(f"/exam-sessions/{sid}/close")
    assert (await student.get(f"/student/exams/{sid}")).json()["result"]["score"] == 1
    assert (await teacher.post(grant)).json()["code"] == "SESSION_CLOSED"
