"""Surveys: an admin runs a sheet for student groups and closes it. The survey keeps its own copy."""

from tests.test_survey_sheets import multi, open_, sheet


async def setup(as_user):
    """An admin, a sheet, group 10-А (aizada, bakyt), group 10-Б (cholpon) and a disabled student."""
    admin, _ = await as_user("root", role="admin")
    gid = (await admin.post("/admin/groups", json={"name": "10-А"})).json()["id"]
    other_gid = (await admin.post("/admin/groups", json={"name": "10-Б"})).json()["id"]
    ids = {}
    for login, group in (("aizada", gid), ("bakyt", gid), ("cholpon", other_gid), ("dana", gid)):
        body = {
            "firstName": login.title(),
            "lastName": "K",
            "login": login,
            "role": "student",
            "groupId": group,
        }
        ids[login] = (await admin.post("/admin/users", json=body)).json()["user"]["id"]
    assert (await admin.post(f"/admin/users/{ids['dana']}/disable")).status_code == 200
    sid = (await admin.post("/admin/survey-sheets", json=sheet())).json()["id"]
    return admin, gid, other_gid, ids, sid


async def test_start_for_groups_list_and_close(as_user):
    admin, gid, _, _, sid = await setup(as_user)
    r = await admin.post("/admin/surveys", json={"sheetId": sid, "groupIds": [gid]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "open" and body["closedAt"] is None
    assert body["title"] == "Term" and body["groupNames"] == ["10-А"]
    # The disabled student is left out.
    assert (body["studentCount"], body["answeredCount"]) == (2, 0)
    assert [q["answered"] for q in body["results"]] == [0, 0, 0]
    assert body["results"][0]["counts"] == [0, 0] and body["results"][2]["texts"] == []

    # Editing the sheet afterwards does not change the survey.
    await admin.put(f"/admin/survey-sheets/{sid}", json=sheet(title="Changed", questions=[open_()]))
    survey = (await admin.get(f"/admin/surveys/{body['id']}")).json()
    assert survey["title"] == "Term" and len(survey["results"]) == 3

    listing = (await admin.get("/admin/surveys")).json()
    assert [(s["id"], s["studentCount"]) for s in listing] == [(body["id"], 2)]

    closed = (await admin.post(f"/admin/surveys/{body['id']}/close")).json()
    assert closed["status"] == "closed" and closed["closedAt"] is not None


async def test_a_used_sheet_is_only_marked_deleted(as_user):
    admin, gid, _, _, sid = await setup(as_user)
    survey = (await admin.post("/admin/surveys", json={"sheetId": sid, "groupIds": [gid]})).json()
    assert (await admin.delete(f"/admin/survey-sheets/{sid}")).status_code == 204
    assert (await admin.get("/admin/survey-sheets")).json() == []
    assert (await admin.get(f"/admin/surveys/{survey['id']}")).json()["title"] == "Term"


async def test_bad_starts(as_user):
    admin, gid, _, _, sid = await setup(as_user)
    empty = (await admin.post("/admin/groups", json={"name": "11-А"})).json()["id"]
    unknown = "00000000-0000-0000-0000-000000000000"
    cases = [
        ({"sheetId": unknown, "groupIds": [gid]}, 404, "SURVEY_NOT_FOUND"),
        ({"sheetId": sid, "groupIds": [unknown]}, 404, "GROUP_NOT_FOUND"),
        ({"sheetId": sid, "groupIds": [empty]}, 400, "SURVEY_NO_STUDENTS"),
        ({"sheetId": sid, "groupIds": []}, 422, "VALIDATION_ERROR"),
    ]
    for body, status, code in cases:
        r = await admin.post("/admin/surveys", json=body)
        assert (r.status_code, r.json()["code"]) == (status, code), body


async def test_who_may_run_and_see_surveys(as_user):
    admin, gid, _, _, sid = await setup(as_user)
    survey = (await admin.post("/admin/surveys", json={"sheetId": sid, "groupIds": [gid]})).json()
    superadmin, _ = await as_user("boss", role="superadmin")
    assert (await superadmin.get("/admin/surveys")).status_code == 200
    assert (await superadmin.get(f"/admin/surveys/{survey['id']}")).status_code == 200
    assert (await superadmin.post(f"/admin/surveys/{survey['id']}/close")).status_code == 403
    assert (
        await superadmin.post("/admin/surveys", json={"sheetId": sid, "groupIds": [gid]})
    ).status_code == 403
    for role in ("teacher", "student"):
        c, _ = await as_user(f"u-{role}", role=role)
        assert (await c.get("/admin/surveys")).status_code == 403
        assert (await c.get(f"/admin/surveys/{survey['id']}")).status_code == 403


async def test_results_count_choices_and_list_open_answers():
    from app.models.survey import SurveyResponse
    from app.services.surveys import results

    questions = [
        {"id": "q1", "kind": "single", "text": "?", "required": True, "choices": ["a", "b"]},
        {**multi(), "required": False, "limit": {"mode": "none", "n": None}},
        {**open_(), "required": False, "maxWords": 100},
    ]
    responses = [
        SurveyResponse(answers={"q1": 1, "q2": [1, 3], "q3": "yes"}),
        SurveyResponse(answers={"q1": 2, "q2": [3]}),
        SurveyResponse(answers={"q1": 1, "q3": "no"}),
    ]
    out = results(questions, responses)
    assert [(r.answered, r.counts) for r in out[:2]] == [(3, [2, 1]), (2, [1, 0, 2])]
    assert out[2].answered == 2 and sorted(out[2].texts or []) == ["no", "yes"]
