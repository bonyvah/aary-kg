"""A student answers a survey once, all at once, and nothing ties the answers to them."""

import asyncio

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models.survey import SurveyRespondent, SurveyResponse
from tests.conftest import login_as
from tests.test_survey_sheets import multi, open_, sheet, single
from tests.test_surveys import setup


async def started(as_user, questions=None, logins=("aizada",)):
    """A survey for 10-А and a logged-in client per student login."""
    admin, gid, _, _, sid, passwords = await setup(as_user)
    if questions is not None:
        await admin.put(f"/admin/survey-sheets/{sid}", json=sheet(questions=questions))
    survey = (await admin.post("/admin/surveys", json={"sheetId": sid, "groupIds": [gid]})).json()
    clients = []
    for login in logins:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        await login_as(c, login, passwords[login])
        clients.append(c)
    return admin, survey["id"], clients


FULL = {"q1": 2, "q2": [3, 1], "q3": "  More art  "}


async def test_list_answer_once_and_read_the_results(as_user):
    admin, svid, (aizada, bakyt) = await started(as_user, logins=("aizada", "bakyt"))
    listing = (await aizada.get("/student/surveys")).json()
    assert [(s["id"], s["answered"], s["questions"]) for s in listing] == [(svid, False, None)]
    page = (await aizada.get(f"/student/surveys/{svid}")).json()
    assert [q["id"] for q in page["questions"]] == ["q1", "q2", "q3"]

    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert r.status_code == 200, r.text
    assert r.json()["answered"] is True and r.json()["questions"] is None

    # The answers can be changed while the survey is open.
    mine = (await aizada.get(f"/student/surveys/{svid}")).json()
    assert mine["answers"] == {"q1": 2, "q2": [1, 3], "q3": "More art"} and mine["questions"] is not None
    again = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert again.status_code == 200

    await bakyt.post(f"/student/surveys/{svid}/submit", json={"answers": {"q1": 1, "q2": [3], "q3": "Fine"}})
    assert (await bakyt.get(f"/student/surveys/{svid}")).json()["answered"] is True

    results = (await admin.get(f"/admin/surveys/{svid}")).json()
    assert results["answeredCount"] == 2
    assert [(q["answered"], q["counts"]) for q in results["results"][:2]] == [(2, [1, 1]), (2, [1, 0, 2])]
    # Stored trimmed.
    assert sorted(results["results"][2]["texts"]) == ["Fine", "More art"]


async def test_an_answer_can_be_changed_until_the_survey_closes(as_user):
    admin, svid, (aizada,) = await started(as_user)
    await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    changed = {"q1": 1, "q2": [2], "q3": "Less art"}
    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": changed})
    assert r.status_code == 200
    assert (await aizada.get(f"/student/surveys/{svid}")).json()["answers"] == changed
    async with SessionLocal() as s:
        stored = list((await s.execute(select(SurveyResponse))).scalars())
    assert [r.answers for r in stored] == [changed]
    assert (await admin.get(f"/admin/surveys/{svid}")).json()["answeredCount"] == 1

    await admin.post(f"/admin/surveys/{svid}/close")
    late = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert (late.status_code, late.json()["code"]) == (409, "SURVEY_CLOSED")
    closed = (await aizada.get(f"/student/surveys/{svid}")).json()
    assert closed["questions"] is None and closed["answers"] is None


async def test_the_admin_sees_who_answered_and_who_did_not(as_user):
    admin, svid, (aizada, bakyt) = await started(as_user, logins=("aizada", "bakyt"))
    await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    students = (await admin.get(f"/admin/surveys/{svid}")).json()["students"]
    assert sorted((s["answered"]) for s in students) == [False, True]
    assert all({"id", "name", "groupName", "answered"} == set(s) for s in students)


async def test_bad_answers_are_listed_per_question(as_user):
    questions = [
        single("s"),
        multi("min", limit={"min": 2}),
        multi("max", limit={"min": 1, "max": 1}),
        multi("exact", limit={"min": 2, "max": 2}),
        open_("o", maxWords=2),
        open_("opt", required=False),
    ]
    _, svid, (aizada,) = await started(as_user, questions=questions)
    bad = {"s": 3, "min": [1], "max": [1, 2], "exact": [1, 2, 3], "o": "x" * 13, "nope": 1}
    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": bad})
    assert (r.status_code, r.json()["code"]) == (400, "SURVEY_ANSWER_INVALID")
    assert [(i["code"], i["field"]) for i in r.json()["issues"]] == [
        ("ANSWER_INVALID", "nope"),
        ("ANSWER_INVALID", "s"),
        ("TOO_FEW", "min"),
        ("TOO_MANY", "max"),
        ("TOO_MANY", "exact"),
        ("TOO_LONG", "o"),
    ]
    missing = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": {"min": []}})
    assert [i["field"] for i in missing.json()["issues"]] == ["s", "min", "max", "exact", "o"]
    assert {i["code"] for i in missing.json()["issues"]} == {"ANSWER_REQUIRED"}

    wrong_types = {"s": [1], "min": 1, "max": "a", "exact": [1, 1], "o": 5}
    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": wrong_types})
    assert {i["code"] for i in r.json()["issues"]} == {"ANSWER_INVALID"} and len(r.json()["issues"]) == 5

    # A blank text is no answer, and an optional question may have none.
    good = {"s": 1, "min": [1, 2], "max": [2], "exact": [2, 3], "o": " " + "x" * 12 + " ", "opt": "  "}
    assert (await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": good})).status_code == 200
    async with SessionLocal() as s:
        stored = (await s.execute(select(SurveyResponse))).scalar_one()
    assert "opt" not in stored.answers and stored.answers["o"] == "x" * 12


async def test_open_answers_never_exceed_650_characters(as_user):
    _, svid, (aizada,) = await started(as_user, questions=[open_("o")])
    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": {"o": "x" * 601}})
    assert [i["code"] for i in r.json()["issues"]] == ["TOO_LONG"]
    assert (
        await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": {"o": "x" * 600}})
    ).status_code == 200


async def test_closed_and_unlisted_surveys(as_user):
    admin, svid, (aizada, cholpon) = await started(as_user, logins=("aizada", "cholpon"))
    # cholpon is in 10-Б: the survey is not theirs.
    assert (await cholpon.get("/student/surveys")).json() == []
    r = await cholpon.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert (r.status_code, r.json()["code"]) == (404, "SURVEY_NOT_FOUND")

    await admin.post(f"/admin/surveys/{svid}/close")
    page = (await aizada.get(f"/student/surveys/{svid}")).json()
    assert page["status"] == "closed" and page["questions"] is None
    r = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert (r.status_code, r.json()["code"]) == (409, "SURVEY_CLOSED")


async def test_two_submits_at_once_leave_one_response(as_user):
    admin, svid, (aizada,) = await started(as_user)
    sends = [aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL}) for _ in range(3)]
    codes = sorted(r.status_code for r in await asyncio.gather(*sends))
    assert codes[0] == 200 and set(codes) <= {200, 409}
    assert (await admin.get(f"/admin/surveys/{svid}")).json()["answeredCount"] == 1
    async with SessionLocal() as s:
        assert len(list((await s.execute(select(SurveyResponse))).scalars())) == 1


async def test_staff_are_refused(as_user):
    _, svid, _ = await started(as_user)
    teacher, _ = await as_user("ulan")
    assert (await teacher.get("/student/surveys")).status_code == 403
    assert (await teacher.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})).status_code == 403


async def test_a_deleted_survey_is_hidden_and_its_rows_stay(as_user):
    admin, svid, (aizada,) = await started(as_user)
    await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert (await admin.delete(f"/admin/surveys/{svid}")).status_code == 204
    async with SessionLocal() as s:
        assert len(list((await s.execute(select(SurveyResponse))).scalars())) == 1
        assert len(list((await s.execute(select(SurveyRespondent))).scalars())) == 1
    assert (await aizada.get(f"/student/surveys/{svid}")).status_code == 404
    assert (await aizada.get("/student/surveys")).json() == []
    late = await aizada.post(f"/student/surveys/{svid}/submit", json={"answers": FULL})
    assert late.status_code == 404
